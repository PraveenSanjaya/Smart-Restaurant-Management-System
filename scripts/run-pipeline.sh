#!/usr/bin/env bash
# SE3112 – Unified test-automation pipeline (local twin of .github/workflows/test-pipeline.yml).
#
#   ./scripts/run-pipeline.sh all                      # every stage, smoke load profile
#   ./scripts/run-pipeline.sh unit                     # Unit Testing & Mocking (+ coverage)
#   ./scripts/run-pipeline.sh mutation [hardened|baseline] [reservation|identity|all]
#   ./scripts/run-pipeline.sh load [smoke|load|stress|spike|soak]
#   ./scripts/run-pipeline.sh race                     # double-booking concurrency test
#   ./scripts/run-pipeline.sh quality                  # static analysis + quality gate (runs unit first if needed)
#   ./scripts/run-pipeline.sh report                   # rebuild artifacts/index.html from whatever exists
#   ./scripts/run-pipeline.sh stack-up | stack-down    # manage the load-test environment by hand
#
# Every stage writes to ./artifacts and the unified dashboard is rebuilt at the end.
# Environment knobs: SKIP_STACK=1 (use an already-running stack), IDENTITY_URL, RESERVATION_URL,
# LOAD_COMPOSE_OVERRIDE=<extra compose file>, K6_IMAGE (default grafana/k6:0.54.0), RACERS, ROUNDS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ART="$ROOT/artifacts"
COMPOSE=(docker compose -f "$ROOT/tests/load/docker-compose.load.yml")
[[ -n "${LOAD_COMPOSE_OVERRIDE:-}" ]] && COMPOSE+=(-f "$LOAD_COMPOSE_OVERRIDE")
K6_IMAGE="${K6_IMAGE:-grafana/k6:0.54.0}"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1

STATUS_FILE="$ART/pipeline-status.env"
mkdir -p "$ART"
touch "$STATUS_FILE"

bold() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
record() { # record <stage> <passed|failed>
  grep -v "^$1=" "$STATUS_FILE" > "$STATUS_FILE.tmp" || true
  echo "$1=$2" >> "$STATUS_FILE.tmp" && mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}
run_stage() { # run_stage <name> <function> [args…] – never aborts the whole pipeline
  local name=$1; shift
  if "$@"; then record "$name" passed; else record "$name" failed; FAILED=1; fi
}
FAILED=0

# ── 1. Unit Testing & Mocking ───────────────────────────────────────────────────────────────
stage_unit() {
  bold "Unit tests (xUnit + Moq) with Coverlet coverage"
  rm -rf "$ART/unit" "$ART/coverage"
  local rc=0
  for project in "$ROOT"/tests/unit/*/*.csproj; do
    local name; name="$(basename "$project" .csproj)"
    dotnet test "$project" -c Release \
      --settings "$ROOT/tests/quality/coverage.runsettings" \
      --results-directory "$ART/unit" \
      --logger "trx;LogFileName=$name.trx" \
      --logger "console;verbosity=minimal" || rc=1
  done
  dotnet tool restore >/dev/null
  dotnet reportgenerator \
    -reports:"$ART/unit/**/coverage.cobertura.xml" \
    -targetdir:"$ART/coverage/report" \
    -reporttypes:"Html;Cobertura;JsonSummary;MarkdownSummaryGithub;Badges" \
    -assemblyfilters:"+identity-service;+reservation-service" \
    -title:"Smart Restaurant – unit test coverage" -verbosity:Warning
  return $rc
}

# ── 2. Mutation Testing ─────────────────────────────────────────────────────────────────────
stage_mutation() {
  local mode="${1:-hardened}" target="${2:-all}" rc=0
  dotnet tool restore >/dev/null
  local services=(reservation identity)
  [[ "$target" != "all" ]] && services=("$target")
  for svc in "${services[@]}"; do
    bold "Mutation testing (Stryker.NET) – $svc service – $mode test suite"
    local config="$ROOT/tests/mutation/stryker-$svc.json"
    if [[ "$mode" == "baseline" ]]; then
      # Same mutants, but without the tests written to kill survivors: shows what the
      # original suite missed. Never breaks the build.
      config="$ART/mutation/stryker-$svc.baseline.json"
      mkdir -p "$ART/mutation"
      node -e '
        const fs = require("fs");
        const c = JSON.parse(fs.readFileSync(process.argv[1]));
        c["stryker-config"]["test-case-filter"] = "Suite!=MutationHardening";
        c["stryker-config"].thresholds.break = 0;
        fs.writeFileSync(process.argv[2], JSON.stringify(c, null, 2));' "$ROOT/tests/mutation/stryker-$svc.json" "$config"
    fi
    rm -rf "$ART/mutation/$svc-$mode"
    (cd "$ROOT/tests/unit/$svc-service-tests" && dotnet stryker --config-file "$config" --output "$ART/mutation/$svc-$mode") || rc=1
  done
  return $rc
}

# ── 3. Load & Performance ───────────────────────────────────────────────────────────────────
stack_up() {
  bold "Starting load-test environment (MySQL + Identity + Reservation)"
  "${COMPOSE[@]}" up -d --build --wait
  # The API containers have no health check, so wait until Kestrel actually answers.
  local url
  for url in "${IDENTITY_URL:-http://localhost:5001}/metrics" "${RESERVATION_URL:-http://localhost:5000}/metrics"; do
    for _ in $(seq 1 60); do
      curl -fs -o /dev/null "$url" && break
      sleep 2
    done
    curl -fs -o /dev/null "$url" || { echo "Service at $url did not become ready" >&2; "${COMPOSE[@]}" logs --tail 50; return 1; }
  done
}
stack_down() {
  "${COMPOSE[@]}" logs --no-color > "$ART/load/service-logs.txt" 2>&1 || true
  "${COMPOSE[@]}" down -v --remove-orphans
}
k6_run() { # k6_run <script> [-e K=V …]
  local script=$1; shift
  mkdir -p "$ART/load"
  local env=(-e "IDENTITY_URL=${IDENTITY_URL:-http://localhost:5001}"
             -e "RESERVATION_URL=${RESERVATION_URL:-http://localhost:5000}"
             -e "RUN_ID=$(date +%s | tail -c 7)")
  if command -v k6 >/dev/null; then
    k6 run -e "K6_OUT_DIR=$ART/load" "${env[@]}" "$@" "$ROOT/tests/load/k6/$script"
  else
    docker run --rm --network host -u "$(id -u):$(id -g)" \
      -v "$ROOT/tests/load/k6:/scripts:ro" -v "$ART/load:/results" \
      "$K6_IMAGE" run -e "K6_OUT_DIR=/results" "${env[@]}" "$@" "/scripts/$script"
  fi
}
with_stack() { # with_stack <command…> – starts/stops the stack unless SKIP_STACK=1
  if [[ "${SKIP_STACK:-0}" == "1" ]]; then "$@"; return; fi
  stack_up
  local rc=0
  "$@" || rc=$?
  stack_down
  return $rc
}
stage_load() {
  local profile="${1:-smoke}"
  bold "Load test (k6) – customer journey – $profile profile"
  with_stack k6_run reservation-journey.js -e "PROFILE=$profile"
}
stage_race() {
  bold "Concurrency test (k6) – double-booking race"
  with_stack k6_run double-booking-race.js -e "RACERS=${RACERS:-50}" -e "ROUNDS=${ROUNDS:-3}"
}
stage_load_and_race() { # one environment for both scripts (used by "all")
  local profile="${1:-smoke}" rc=0
  bold "Load + concurrency tests (k6) – $profile profile"
  if [[ "${SKIP_STACK:-0}" != "1" ]]; then stack_up; fi
  k6_run reservation-journey.js -e "PROFILE=$profile" || rc=1
  k6_run double-booking-race.js -e "RACERS=${RACERS:-50}" -e "ROUNDS=${ROUNDS:-3}" || rc=1
  if [[ "${SKIP_STACK:-0}" != "1" ]]; then stack_down; fi
  return $rc
}

# ── 4. Code Quality & Metrics ───────────────────────────────────────────────────────────────
stage_quality() {
  [[ -f "$ART/coverage/report/Cobertura.xml" ]] || stage_unit || true
  bold "Static analysis: Roslyn .NET analyzers (SARIF)"
  rm -rf "$ART/quality"
  for project in "$ROOT"/backend/*/*.csproj; do
    dotnet build "$project" -c Release --no-incremental -p:RunCodeQuality=true -p:CodeQualityOutDir="$ART/quality/sarif/" -v:q -clp:NoSummary
  done
  bold "Static analysis: ESLint (React frontend)"
  (cd "$ROOT/frontend/restaurant-web" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund; } \
    && npx eslint . -f json -o "$ART/quality/eslint.json" || true)
  bold "Quality gate"
  node "$ROOT/tests/quality/quality-gate.mjs" --artifacts "$ART"
}

# ── Unified report ──────────────────────────────────────────────────────────────────────────
stage_report() {
  bold "Building unified dashboard"
  node "$ROOT/tests/report/build-dashboard.mjs" --artifacts "$ART"
}

cmd="${1:-all}"; shift || true
case "$cmd" in
  unit)      run_stage unit stage_unit ;;
  mutation)  run_stage mutation stage_mutation "$@" ;;
  load)      run_stage load stage_load "$@" ;;
  race)      run_stage race stage_race ;;
  quality)   run_stage quality stage_quality ;;
  report)    stage_report; exit 0 ;;
  stack-up)  stack_up; exit 0 ;;
  stack-down) mkdir -p "$ART/load"; stack_down; exit 0 ;;
  all)
    rm -f "$STATUS_FILE"; touch "$STATUS_FILE"
    dotnet restore "$ROOT/tests/unit/reservation-service-tests" >/dev/null
    dotnet restore "$ROOT/tests/unit/identity-service-tests" >/dev/null
    run_stage unit stage_unit
    run_stage quality stage_quality
    run_stage mutation stage_mutation hardened all
    run_stage load stage_load_and_race "${1:-smoke}"
    ;;
  *) sed -n '2,16p' "$0"; exit 2 ;;
esac

stage_report
echo
cat "$STATUS_FILE"
exit $FAILED
