# Testing

| Folder | What | Run |
|---|---|---|
| `unit/` | xUnit + Moq unit tests per service (SE3022 tests + SE3112 `UnitMocking` and `MutationHardening` suites) | `./scripts/run-pipeline.sh unit` |
| `mutation/` | Stryker.NET configuration | `./scripts/run-pipeline.sh mutation` |
| `load/` | k6 load, stress, spike and concurrency tests + Docker Compose environment | `./scripts/run-pipeline.sh load load` |
| `quality/` | coverage settings, analyzer rules, quality gate | `./scripts/run-pipeline.sh quality` |
| `report/` | unified dashboard builder and team/role mapping | `./scripts/run-pipeline.sh report` |
| `integration/` | MySQL-backed integration tests (SE3022) | see `.github/workflows/ci.yml` |
| `selenium/` | Selenium UI tests (SE3022) | see `selenium/SmartRestaurant.SeleniumTests/README.md` |

The full pipeline is described in the root [README](../README.md#se3112--microservice-testing-pipeline).
