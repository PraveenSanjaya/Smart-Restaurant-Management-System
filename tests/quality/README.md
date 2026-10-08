# Code Quality & Metrics

**Owner:** Wijesinghe K. (IT24102587) · **Tools:** Roslyn .NET analyzers (SARIF 2.1), ESLint 10, Coverlet + ReportGenerator, custom quality gate (`quality-gate.mjs`)

The goal is SonarQube-style quality indicators and a pass/fail **quality gate**, computed in the pipeline with no external server or tokens.

```
Directory.Build.props          opt-in analysis profile (dotnet build -p:RunCodeQuality=true)
tests/quality/
├── code-quality.globalconfig   rules raised to warning (complexity, coupling, SQL injection, dead code…)
├── CodeMetricsConfig.txt       CA1502 cyclomatic complexity > 15, CA1506 coupling limits
├── coverage.runsettings        Coverlet: production assemblies only, Program.cs excluded
├── quality-gate.config.json    gate thresholds, SQALE remediation minutes, reviewed hotspots
└── quality-gate.mjs            SARIF + ESLint + Cobertura → metrics, ratings, gate, HTML/MD/JSON
frontend/restaurant-web/eslint.config.js   ESLint flat config (react-hooks, complexity, max-lines…)
```

Normal `dotnet build` is unchanged. The analysis profile only switches on with `-p:RunCodeQuality=true`, so day-to-day development is not slowed down or flooded with warnings.

## Metrics produced

| Indicator | How it is computed |
|---|---|
| **Coverage** (line / branch / per service) | Coverlet collector → ReportGenerator merges both test projects into one Cobertura file |
| **Code smells** | every analyzer warning (SARIF) + every ESLint problem, de-duplicated |
| **Technical debt** | Σ remediation minutes per rule (SQALE model, e.g. CA1502 complexity = 30 min, CA1848 logging = 5 min), shown in 8-hour days |
| **Debt ratio** | debt ÷ (lines of code × 30 min to write one line) |
| **Maintainability rating** | A ≤ 5% · B ≤ 10% · C ≤ 20% · D ≤ 50% · E (SonarQube bands) |
| **Security rating** | A if every security hotspot (CA2100 SQL, CA5350/5351 crypto, CA5394 randomness) is reviewed, else E |
| **Reliability rating** | A with no errors; C/D when ESLint errors exist |
| **Hot files** | top 10 files by debt; where to refactor first |

## Quality gate

| Condition | Threshold | Current |
|---|---|---|
| Line coverage | ≥ 65% | 68.6% |
| Branch coverage | ≥ 60% | 68.1% |
| Unreviewed security hotspots | 0 | 0 (4 reviewed) |
| .NET analyzer errors | 0 | 0 |
| Maintainability rating | ≤ B | A (0.62%) |
| .NET code smells (ratchet) | ≤ 82 | 82 |
| ESLint problems / errors (ratchet) | ≤ 40 / ≤ 10 | 40 / 10 |

**Clean as you code (ratchet).** The legacy debt in the SE3022 code is accepted as the baseline, but no PR may add to it. Paying debt off means lowering the ratchet numbers in `quality-gate.config.json`, which locks the improvement in.

**Security hotspot review.** CA2100 flags every `MySqlCommand` whose SQL text isn't a constant. The 4 hits (`GetForAdminAsync`, `ClaimBatchAsync`) were reviewed by hand. Only constant fragments and generated `@IdN` placeholder names are concatenated, and every user value is a bound parameter. Each one is recorded as **SAFE with a justification** in `quality-gate.config.json`. Any *new* CA2100 location fails the gate until someone reviews it, which mirrors SonarQube's hotspot workflow.

## Findings worth discussing

| Finding | Rule | Debt |
|---|---|---|
| `AvailabilitySearchValidator.TryValidate` cyclomatic complexity **26** (limit 15) | CA1502 | split into per-field rules |
| `ReservationsController` coupled to **85** types | CA1506 | split admin and customer controllers |
| `UserService._logger` assigned but never used | IDE0052 | dead field |
| 38 logging calls without `LoggerMessage` source generators | CA1848 | allocation on hot paths |
| 25 culture-sensitive `ToString`/`Parse` calls | CA1305 | locale bugs on non-en servers |
| 8 effects call `setState` synchronously in `useEffect` | react-hooks/set-state-in-effect | cascading re-renders |
| `handleClose` used before it is declared (2 modals) | react-hooks/immutability | real bug risk |

## Run

```bash
./scripts/run-pipeline.sh quality      # runs unit tests first if no coverage exists yet
node tests/quality/quality-gate.mjs --no-fail   # recompute from existing artifacts, never fail
```

Reports: `artifacts/quality/quality-report.html`, `artifacts/coverage/report/index.html`, and raw `artifacts/quality/sarif/*.sarif` (these open in VS Code's SARIF viewer or GitHub code scanning).

**Demo idea:** add a method with a deep `if/else` chain (or a `new MySqlCommand("… " + input)`), re-run `quality`, and watch the gate fail on the ratchet (or on an unreviewed hotspot).
