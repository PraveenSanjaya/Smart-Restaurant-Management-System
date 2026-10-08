# Cinnamon Bistro

**Smart Restaurant Table Reservation & Order Management System**

SE3022 Case Study Project — Year 3 Semester 1

## Overview

Cinnamon Bistro is a restaurant management project developed across four sprints. Sprint 1 implements Identity & Access and core Table & Seating Management through a React frontend and two ASP.NET Core microservices. Reservation workflows are the next scope; ordering, kitchen operations, billing, and reporting remain later milestones.

## SE3112 — Microservice Testing Pipeline

Take-home assessment for **SE3112 Advanced Software Engineering**. The SE3022 microservices (Identity + Reservation, ASP.NET Core 10 / MySQL) are the system under test. The group built one test-automation pipeline, and each member owns one testing paradigm inside it.

| Role | Owner | Tools | Where | Detailed README |
|---|---|---|---|---|
| Unit Testing & Mocking | H.R.M.A.A. Bandara (IT24100315) | xUnit, Moq, Coverlet | `tests/unit/*/UnitMocking/` | [tests/unit/README.md](tests/unit/README.md) |
| Mutation Testing | H. L. P. S. Perera (IT24101848) | Stryker.NET | `tests/mutation/`, `tests/unit/*/MutationHardening/` | [tests/mutation/README.md](tests/mutation/README.md) |
| Load & Performance Testing | D.M.N. Pesanjith (IT24101505) | k6, Docker Compose | `tests/load/` | [tests/load/README.md](tests/load/README.md) |
| Code Quality & Metrics | Wijesinghe K. (IT24102587) | Roslyn analyzers (SARIF), ESLint, ReportGenerator, quality gate | `tests/quality/`, `Directory.Build.props`, `frontend/restaurant-web/eslint.config.js` | [tests/quality/README.md](tests/quality/README.md) |
| Test automation (group) | all | GitHub Actions, Bash, Node | `.github/workflows/test-pipeline.yml`, `scripts/run-pipeline.sh`, `tests/report/` | this section |

One-page architecture: [docs/testing-pipeline/architecture.pdf](docs/testing-pipeline/architecture.pdf)

### Pipeline

```text
                    ┌─► Unit Testing & Mocking ─┬─► Code Quality gate ───────┐
 push / PR / manual │   (xUnit+Moq, coverage)   └─► Mutation Testing ────────┤
 ──► Build ─────────┤                               (Stryker, 2 services)    ├─► Unified report
     (.NET, React)  └─► Load & Performance  (Docker Compose stack + k6:      │   (dashboard + job
                        customer journey + double-booking race) ─────────────┘    summary + artifact)
```

- **CI/CD:** [`.github/workflows/test-pipeline.yml`](.github/workflows/test-pipeline.yml) runs on every push to `main`, `develop`, `feature/**`, `test/**` and on PRs. A manual run (**Actions → SE3112 Test Pipeline → Run workflow**) lets you pick the k6 profile (`smoke | load | stress | spike | soak`) and whether to include the mutation baseline.
- **Local twin:** [`scripts/run-pipeline.sh`](scripts/run-pipeline.sh) runs exactly the same stages on a laptop, so every demo is reproducible offline.
- **Unified reporting:** each stage writes to `artifacts/`. `tests/report/build-dashboard.mjs` merges everything into `artifacts/index.html` (one card per role, linking to each detailed report) and `artifacts/pipeline-summary.md`, which CI appends to the run's *Summary* page. In CI the whole folder is downloadable as the **pipeline-report** artifact.

### Tool setup

| Tool | Version | Install |
|---|---|---|
| .NET SDK | 10.0 | <https://dot.net> (`dotnet --list-sdks`) |
| Node.js | 20.19+ / 22 | <https://nodejs.org> |
| Docker + Compose v2 | 24+ | Docker Desktop / Engine. Used for the load-test stack and for k6 if it isn't installed |
| Stryker.NET, ReportGenerator | pinned in [`dotnet-tools.json`](dotnet-tools.json) | `dotnet tool restore` (the script does this) |
| k6 | 0.54+ | optional: <https://grafana.com/docs/k6/latest/set-up/install-k6/>; otherwise the script uses the `grafana/k6` Docker image |

### Pipeline commands

```bash
./scripts/run-pipeline.sh all                 # every stage, then the dashboard (≈ 12 min)
./scripts/run-pipeline.sh unit                # unit tests + coverage            (≈ 30 s)
./scripts/run-pipeline.sh quality             # analyzers + ESLint + quality gate (≈ 1 min)
./scripts/run-pipeline.sh mutation hardened   # Stryker, both services           (≈ 5 min)
./scripts/run-pipeline.sh mutation baseline reservation   # the "before" score
./scripts/run-pipeline.sh load load           # k6 journey; profiles: smoke|load|stress|spike|soak
./scripts/run-pipeline.sh race                # k6 double-booking concurrency test
./scripts/run-pipeline.sh report              # rebuild artifacts/index.html
```

Open `artifacts/index.html` afterwards. On Windows, run the script from Git Bash or WSL.

### Results at a glance (local run)

| Paradigm | Key result |
|---|---|
| Unit & Mocking | 414 tests pass (207 new: 184 unit/mocking + 23 mutation-hardening); coverage 68.6% line / 68.1% branch |
| Mutation | Reservation 81.5% → **97.5%**, Identity 82.2% → **100%** after killing the survivors; the 3 remaining mutants are provably equivalent |
| Load | `load` profile: every SLO threshold passes, 0% errors, reservation endpoints p95 < 10 ms. `stress` finds the bottleneck: BCrypt login saturates at about 25/s. Race test: exactly 1 of 50 concurrent bookings wins in each round |
| Code quality | Gate passed: maintainability **A** (debt ratio 0.62%, ~3 days of debt), security **A** (4 SQL hotspots reviewed), reliability **C** (10 legacy ESLint errors, ratcheted) |

## Sprint 1 — Foundation & Core Access

### Sprint 1 Goal

Deliver secure registration/login, role-based access control, customer profile management, and core restaurant table management, supported by containerization and CI/CD configuration.

### Sprint 1 Team Members

| Team member | Student ID | Sprint 1 role |
| --- | --- | --- |
| D.M.N. Pesanjith | IT24101505 | Business Analytics / Project Management |
| H. L. P. S. Perera | IT24101848 | QA Engineer |
| H.R.M.A.A. Bandara | IT24100315 | Developer |
| Wijesinghe K. | IT24102587 | DevOps |

### Completed Features

| Story | Implemented behavior |
| --- | --- |
| SR-7 — User Registration | Customer registration, duplicate-email checks, BCrypt password hashing, and authorization-code checks for Admin/KitchenStaff registration. |
| SR-8 — JWT Authentication and Login | Credential validation, rejection of inactive users, signed JWT issuance, and bearer-token validation in both APIs. |
| SR-9 — Role-Based Access Control | Customer, Admin, and KitchenStaff roles; backend authorization attributes/policies and protected frontend routes. |
| SR-10 — Customer Profile Management | Authenticated profile retrieval and contact-information updates using the user ID from JWT claims, with duplicate-email checks. |
| SR-11 — Restaurant Table Creation | Admin-only creation with table number, capacity, location, validated initial status, and duplicate table-number handling. |
| SR-12 — Table Management and Status Updates | Admin table listing/filtering, detail retrieval, capacity/location updates, occupied-table release, and soft deactivation. |

Table statuses are `Available`, `Occupied`, and `Inactive`. The update endpoint normally changes capacity/location. An occupied table can be released by explicitly requesting `Available`, including capacity/location changes in that request; other occupied-table edits and occupied-table deactivation are rejected. Deactivation sets `IsActive` to false and status to `Inactive`, preserving the database row. Arbitrary status transitions and reactivation are not implemented by the current update endpoint.

The public `/api/tables/availability` endpoint currently returns a static response. Date/time/guest-count availability and reservation booking are Sprint 2 work.

### Technology Stack

| Area | Repository implementation |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios; versions resolved in `package-lock.json` (`package.json` uses `latest`) |
| Backend | ASP.NET Core Web API, .NET 10 (`net10.0`) |
| Architecture | Identity and Reservation microservices |
| Data access | ADO.NET/direct parameterized SQL through MySqlConnector |
| Database | MySQL 8.0 in local Compose; separate Identity and Reservation schemas |
| Authentication | JWT bearer authentication and BCrypt.Net-Next |
| API documentation | Swagger/OpenAPI in Development mode |
| Container hosting | Docker multi-stage builds; Nginx serves the frontend and proxies API requests |
| CI/CD and cloud target | GitHub Actions, Azure Container Registry, Azure Container Apps, Azure OIDC authentication |
| Automated testing | xUnit/Moq for backend tests; Node.js built-in test runner for frontend tests |
| Metrics | Prometheus HTTP metrics middleware in both APIs; monitoring deployment remains a scaffold |

### System Architecture

```text
Browser / React frontend
        |
        +-- /api/* ------------> Identity API ----> Identity MySQL schema
        |                         issues JWT
        +-- /reservation-api/* -> Reservation API -> Reservation MySQL schema
                                  validates JWT
```

Nginx provides these routes for containerized builds. During Vite development, the browser calls the APIs directly. Frontend API clients attach the stored JWT to requests; the APIs enforce authorization.

### Project Structure

```text
backend/
  identity-service/          # Authentication, roles, profiles, Dockerfile
  reservation-service/       # Table management, Dockerfile
  order-service/             # Future service scaffold
  billing-report-service/    # Future service scaffold
frontend/restaurant-web/     # React app, tests, local/Azure Dockerfiles
database/
  identity-db/               # Identity schema initialization
  reservation-db/            # Restaurant table schema initialization
tests/unit/
  identity-service-tests/    # xUnit project
  reservation-service-tests/ # xUnit project
docs/                       # Planning, QA, API and sprint-review scaffolds
monitoring/                 # Monitoring documentation scaffold
.github/                    # CI/CD workflows and issue/PR templates
docker-compose.yml          # Local four-service environment
.env.example                # Configuration template
```

### Local Development

**Prerequisites:** Docker Desktop with Compose for container development. For host development, install Node.js compatible with the locked Vite version (20.19+ or 22.12+) and the .NET 10 SDK. MySQL 8.0 can run through Compose or a separately configured local installation.

Run commands from the repository root unless another directory is shown.

1. Create a root `.env` from `.env.example` if it does not already exist. Supply private values locally. Compose requires `MYSQL_ROOT_PASSWORD`, `MYSQL_HOST_PORT`, `IDENTITY_DB_NAME`, `RESERVATION_DB_NAME`, `JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`, and `STAFF_AUTHORIZATION_CODE`. Match database names to the initialization scripts: `restaurant_identity_db` and `restaurant_reservation_db`.
2. For host-run APIs, configure `ConnectionStrings__DefaultConnection` separately for each service and set matching `Jwt__Key`, `Jwt__Issuer`, and `Jwt__Audience` environment variables. Set `Staff__AuthorizationCode` for Identity. A root `.env` is consumed by Compose, not automatically by `dotnet run`.
3. Start MySQL, then run each API in its own terminal:

```sh
docker compose up -d mysql
dotnet run --project backend/identity-service/identity-service.csproj --no-launch-profile --urls http://localhost:5001
dotnet run --project backend/reservation-service/reservation-service.csproj --no-launch-profile --urls http://localhost:5000
```

Configure each host API to use the published MySQL host port and its own schema. For standalone MySQL, apply the SQL initialization files under `database/` first. Set `ASPNETCORE_ENVIRONMENT=Development` when Swagger access is needed.

Start the frontend in another terminal:

```sh
cd frontend/restaurant-web
npm ci
npm run dev
```

Open `http://localhost:5173`. The frontend uses `VITE_API_URL` for Identity (default `http://localhost:5001/api`) and `VITE_RESERVATION_API_URL` for Reservation (default `http://localhost:5000/api`). Vite variables are public build configuration and must never contain secrets. `npm run build` creates the production bundle; `npm run preview` previews it locally.

### Docker / Docker Compose

After configuring the root `.env`:

```sh
docker compose up --build -d
docker compose ps
```

Open `http://localhost`. Stop the environment with `docker compose down`; the named MySQL volume is retained.

| Service | Container implementation | Published port |
| --- | --- | --- |
| `mysql` | MySQL 8.0, initialization SQL, `mysql_data` persistent volume, health check | Configured by `MYSQL_HOST_PORT` |
| `identity-service` | .NET 10 SDK build/publish stage and ASP.NET runtime stage | 5001 |
| `reservation-service` | .NET 10 SDK build/publish stage and ASP.NET runtime stage | 5000 |
| `frontend` | Node 20 Alpine build with `npm ci`; Nginx Alpine runtime using `nginx.conf` | 80 |

All services share the `restaurant-network` bridge network. APIs wait for MySQL to become healthy; the frontend depends on both API containers starting, without an API readiness check. SQL initialization runs when MySQL initializes an empty data volume. Compose supplies API configuration through environment variables and provides a local multi-container environment for integration testing.

The Azure frontend build uses `Dockerfile.azure` and `nginx.azure.conf` to proxy to HTTPS Container Apps API endpoints. The standard Dockerfile uses local Compose service names.

### Testing & QA

Backend test projects cover authentication, password hashing, JWT generation, role authorization, profile operations, table-controller behavior, and repository validation. Run them from the root:

```sh
dotnet test tests/unit/identity-service-tests/identity-service-tests.csproj --configuration Release
dotnet test tests/unit/reservation-service-tests/reservation-service-tests.csproj --configuration Release
```

Frontend tests cover role routing, profile validation, table validation, and admin table-management behavior. From `frontend/restaurant-web`, after installing dependencies:

```sh
npm test
npm run build
```

Frontend automated tests exist, but the current CI workflow only installs dependencies and builds the frontend; it does not run `npm test`. No numerical pass totals are published here because committed test-result reports are absent. Source test definitions alone do not establish successful execution.

The supplied Sprint 1 review summary reports functional registration/login, JWT/RBAC, profile, table management, Postman/API, and Selenium/UI testing. Repository QA and sprint-review documents are currently templates, with no corresponding execution evidence or Postman/Selenium suites checked in. Load and performance testing is implemented with k6 as part of the SE3112 pipeline (see above).

### CI Pipeline

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes and pull requests targeting `main` or `develop`:

- **Repository validation:** checks for `frontend`, `backend`, `database`, `tests`, `docs`, and `monitoring` directories.
- **Frontend:** sets up Node 20, checks for `index.html`, runs `npm install`, and runs `npm run build`.
- **Backend:** sets up .NET 10, discovers backend `.csproj` files, restores dependencies, and builds in Release mode.
- **Tests:** discovers test `.csproj` files and runs `dotnet test` in Release mode.

The workflow defines validation jobs; it does not itself prove a passing run or enforce branch protection.

### CD Pipeline

[`.github/workflows/cd.yml`](.github/workflows/cd.yml) runs on pushes to `develop`. It:

1. Authenticates with `azure/login@v2` using OIDC (`id-token: write`).
2. Logs in to Azure Container Registry.
3. Builds Identity, Reservation, and the Azure frontend images.
4. Pushes commit-SHA tags plus `latest` for the APIs and `azure` for the frontend.
5. Updates the three existing Azure Container Apps to the commit-SHA images.

OIDC uses short-lived federated authentication and avoids storing a long-lived Azure client secret. Azure-side federated identity and resource permissions must already be configured. The workflow updates existing infrastructure; it does not provision it. CD triggers independently of CI and contains no explicit CI-success dependency or post-deployment validation step.

### Azure Cloud Deployment

The committed deployment configuration targets:

| Resource | Confirmed configuration |
| --- | --- |
| Resource group | `rg-cinnamon-bistro-dev` |
| Azure Container Registry | `acrcinnamonbistrodev` |
| Image repositories | `frontend`, `identity-service`, `reservation-service` |
| Container Apps | `frontend-web`, `identity-api`, `reservation-api` |
| API routing | HTTPS Container Apps upstreams in the Azure Nginx configuration |

The Sprint 1 review information supplied by the team additionally reports an Azure Container Apps Environment and Azure Database for MySQL Flexible Server. Their provisioning definitions and deployment-result evidence are not committed, so their live state cannot be established from this checkout.

```text
GitHub repository
      |
GitHub Actions CI / CD (separate workflows)
      | CD builds and pushes images
Azure Container Registry
      |
Azure Container Apps Environment
      +-- frontend-web
      +-- identity-api ------+
      +-- reservation-api ---+--> Azure MySQL Flexible Server
                                 (reported Sprint 1 infrastructure)
```

### Deployment Validation

**Team-reported Sprint 1 review outcome:** successful public frontend access over HTTPS with HTTP 200, admin authentication, JWT-protected API access, restaurant table data returned by the Reservation API, backend connectivity to Azure MySQL, and end-to-end validation:

```text
Frontend → Identity API → JWT Authentication → Reservation API → Azure MySQL
```

This summarizes the supplied review information, rather than a fresh deployment check. The repository contains no saved HTTP responses, cloud test reports, or automated CD smoke checks confirming those outcomes.

**Current cloud status (team-reported):** After the Sprint 1 review, active Azure compute resources were stopped when not required in order to conserve Azure for Students credit. The deployment configuration, container images, and infrastructure setup are retained and can be started again for Sprint 2 development or demonstrations. This was an intentional pause after successful validation, not a deployment failure; live resource state is not verified by this README.

### Security Practices

- JWT validation checks signing key, issuer, audience, and lifetime; APIs enforce role-based access.
- Passwords are hashed with BCrypt, and repositories use parameterized SQL.
- Compose supports environment-variable configuration for credentials, JWT settings, and staff authorization. Supply private values through local configuration or deployment secrets; never publish them in documentation or frontend variables.
- The source still contains fallback authentication configuration; environment-variable support should not be interpreted as proof that all hardcoded defaults have been removed.
- GitHub Actions uses Azure OIDC for deployment authentication. Azure Nginx uses HTTPS API upstreams; public HTTPS access is reported in the Sprint 1 review.
- The PR template includes review, testing, and no-secrets checks. Enforced branch protection and required reviews/status checks must be verified in GitHub repository settings.

### Sprint 1 Status

**Sprint 1 completed: all 10 of 10 work items are Done**, according to the final Sprint 1 Jira board provided by the team.

| Jira item | Work item | Final status |
| --- | --- | --- |
| SR-7 | User Registration & Password Hashing | Done |
| SR-8 | JWT Authentication & Login Flow | Done |
| SR-9 | Role-Based Access Control & Navigation | Done |
| SR-10 | User Profile View & Management | Done |
| SR-11 | Restaurant Table Creation & Capacity Setup (CRUD) | Done |
| SR-12 | Restaurant Table Management & Status Updates (CRUD) | Done |
| SR-14 | Monorepo & Git Branching Setup | Done |
| SR-16 | Unit Testing & Initial QA Test Cases | Done |
| SR-15 | GitHub Actions CI Pipeline Setup | Done |
| SR-22 | DevOps Deployment Validation and Review Preparation | Done |

This final Jira state supersedes earlier sprint-progress updates. Unit testing and deployment validation were completed within Sprint 1. Sprint 2 begins with the reservation workflow described below.

The implementation summary below records the repository evidence supporting the completed sprint; Jira completion does not introduce additional functionality or test pass counts.

| Area | Status supported by the checkout |
| --- | --- |
| Identity & Access | Implemented |
| Core Table Management | Implemented, with the status-transition limits described above |
| Backend microservices | Source, database access, and runnable projects present |
| CI | Repository, frontend-build, backend-build, and xUnit jobs configured |
| Docker containerization / local integration | API/frontend Dockerfiles and four-service Compose environment implemented |
| Azure deployment / CD | Image build, push, routing, and Container Apps update configuration implemented |
| Azure operation / end-to-end validation | Successful completion reported by the team; execution evidence not committed |

Technical integration considerations visible in the implementation include matching JWT settings across APIs, aligning frontend API paths with Nginx routing, preserving table rows and occupied-table rules, and configuring OIDC for Azure deployments. Commit history records frontend API-routing and Azure authentication configuration changes; a detailed authentication defect report is not available.

### Sprint 2 — Next Scope

The supplied sprint plan targets customer table search by date/time/guest count, reservation creation, and reservation management, plus admin reservation management and reporting/visibility.

Key risks are double-booking and concurrency, accurate time-based availability, consistent reservation status/history, and integration/testing complexity. Delivery depends on Sprint 1 authentication, RBAC, table management, database/API infrastructure, and CI.

The wider project roadmap remains:

1. **Sprint 1:** Foundation, Authentication & Table Management.
2. **Sprint 2:** Reservation Management.
3. **Sprint 3:** Menu, Ordering & Kitchen Management.
4. **Sprint 4:** Billing, Payments, Reports, Testing & Deployment.

Order and Billing & Report service directories are scaffolds, not completed services. Prometheus middleware is present; a Prometheus/Grafana deployment is not included in Compose.

## Team

Roles below follow the team and sprint plan supplied for this README update.

| Team member | Student ID | Sprint 1 role | Sprint 2 role |
| --- | --- | --- | --- |
| D.M.N. Pesanjith | IT24101505 | Business Analytics / Project Management | DevOps |
| H. L. P. S. Perera | IT24101848 | QA Engineer | Developer |
| H.R.M.A.A. Bandara | IT24100315 | Developer | Business Analytics |
| Wijesinghe K. | IT24102587 | DevOps | QA Engineer |

## Repository / Contribution Workflow

Git history shows `feature/*` branches merged through pull requests, and CI targets both `develop` and `main`. Use feature branches for scoped work, submit PRs into `develop` for integration, and promote reviewed work to `main` according to the team's release process.

Complete the [pull request template](.github/pull_request_template.md), link the Jira/user story, describe changes and testing, obtain code review, and check CI before merging. Branch protection, mandatory approvals, and required CI checks are GitHub-hosted settings and cannot be confirmed from local files. A push to `develop` also triggers CD.
