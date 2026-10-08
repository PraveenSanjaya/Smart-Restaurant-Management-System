# Load & Performance Testing

**Owner:** D.M.N. Pesanjith (IT24101505) · **Tools:** k6 (Grafana), Docker Compose

## Environment

`docker-compose.load.yml` starts a disposable stack: MySQL 8 (with every migration in `database/`) plus the Identity service (`:5001`) and the Reservation service (`:5000`), built from their real Dockerfiles. MySQL data lives on `tmpfs`, so every run starts clean and fast. The Kafka outbox publisher is switched off with `Kafka__PublisherEnabled=false`. Bookings still write to the transactional outbox table, so the measured write path is the production one.

## Scripts

```
tests/load/k6/
├── reservation-journey.js   mixed workload, 5 profiles
├── double-booking-race.js   correctness under high concurrency
└── lib/
    ├── config.js    URLs, workload profiles, SLO thresholds
    ├── api.js       one function per endpoint; each request is tagged {endpoint:…} and checked
    ├── data.js      realistic slots inside opening hours; a narrow date window forces contention
    └── summary.js   handleSummary → console + JSON + Markdown + HTML (no remote imports)
```

### 1. Customer journey (`reservation-journey.js`)

Two scenarios run in parallel:

| Scenario | Model | What a virtual user does |
|---|---|---|
| `journey` | **closed** (virtual users with think time) | browse active tables → search availability → book a random offered table (with an `Idempotency-Key`) → view the booking → cancel 30% of bookings → view history |
| `login` | **open** (fixed arrival rate) | `POST /api/auth/login` (BCrypt verify, so CPU-bound) |

`setup()` creates an admin, 12 extra tables and a pool of 20 customers (`CUSTOMER_POOL`), then passes JWTs to the VUs, so the journey measures the reservation API rather than repeated logins.

| Profile | Shape | Purpose |
|---|---|---|
| `smoke` | 2 VUs × 30 s | scripts and environment work (every push) |
| `load` | 0 → 20 VUs → hold 1 min → 0 | expected peak; **the SLO gate** |
| `stress` | 50 → 100 → 150 VUs; login 15 → 30/s | find the knee |
| `spike` | 5 → **200 VUs in 10 s** → 5 | sudden promotion traffic, then recovery |
| `soak` | 30 VUs × 15 min (`SOAK_DURATION`) | leaks, connection-pool exhaustion |

**SLOs (thresholds):** error rate < 1%, checks > 99%, p95 per endpoint (tables 300 ms, availability 500 ms, booking 800 ms, detail 300 ms, history 400 ms, login 1500 ms), journey server time p95 < 1.5 s, booking success > 50%.
`409 Conflict` on booking is marked as an *expected* status (`http.expectedStatuses(…, 409)`). Losing a race is correct business behaviour, not an HTTP failure. It is counted separately in `booking_conflicts`.

### 2. Double-booking race (`double-booking-race.js`)

50 VUs are released on a shared "starting gun" timestamp and all book **the same table for the same period**. This repeats for 3 rounds on different tables. The service locks the table row (`SELECT … FOR UPDATE`) and re-checks overlap inside the transaction, so:

- `race_bookings_created count == 3` (exactly one winner per round)
- `race_conflicts count == 147` (everybody else gets `409 TABLE_NO_LONGER_AVAILABLE`)
- `race_unexpected_responses count == 0` (no 500s or deadlock errors)
- `race_rounds_with_exactly_one_booking == 3`: `teardown()` asks the admin API independently how many active bookings each table holds

## Run

```bash
./scripts/run-pipeline.sh load smoke        # starts the stack, runs, stops it
./scripts/run-pipeline.sh load load
./scripts/run-pipeline.sh race
# keep the stack up between runs:
./scripts/run-pipeline.sh stack-up
SKIP_STACK=1 ./scripts/run-pipeline.sh load stress
./scripts/run-pipeline.sh stack-down
# plain k6, against any environment:
k6 run -e PROFILE=spike -e IDENTITY_URL=http://host:5001 -e RESERVATION_URL=http://host:5000 tests/load/k6/reservation-journey.js
```

Reports: `artifacts/load/<test>-report.html`, plus `-summary.json` / `-summary.md`.

## Results (local run, 4 vCPU)

| Run | Requests | Throughput | Errors | Reservation endpoints p95 | Login p95 | Bookings / 409s | SLOs |
|---|---:|---:|---:|---:|---:|---:|:---:|
| smoke (2 VUs) | 138 | 3.4/s | 0% | ≤ 25 ms | 194 ms | 10 / 0 | ✅ all |
| load (20 VUs + 5 logins/s) | 1 963 | 16.7/s | 0% | ≤ 10 ms | 197 ms | 261 / 0 | ✅ all |
| stress (150 VUs + 30 logins/s) | 15 306 | 78.1/s | 0.01% | ≤ 15 ms | **9 167 ms** | 2 316 / 35 | ❌ login p95 |
| race (50 × 3) | 150 | – | 0% | 510 ms (contended) | – | 3 / 147 | ✅ all |

**Interpretation:** the reservation endpoints scale almost flat; MySQL row locking adds about 0.5 s only under a deliberate 50-way race. The bottleneck is **login**: BCrypt (work factor 11) costs about 175 ms of CPU per call, so roughly 20–25 logins/s saturate 4 cores, and beyond that requests queue (p95 9 s, max 26 s). Possible fixes: scale Identity horizontally (it is stateless), rate-limit `/login`, or keep the work factor and accept it as the deliberate cost of password security. JWTs already keep other requests away from Identity.
