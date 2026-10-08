# Unit Testing & Mocking

**Owner:** H.R.M.A.A. Bandara (IT24100315) · **Tools:** xUnit 2, Moq 4, Coverlet, ReportGenerator

The unit tests isolate service logic from MySQL, Kafka, BCrypt, JWT signing and the clock, so they run in milliseconds with no infrastructure. The SE3112 suites sit next to the existing SE3022 tests:

```
tests/unit/
├── reservation-service-tests/
│   ├── UnitMocking/                         ← SE3112 Unit Testing & Mocking
│   │   ├── TestDoubles/FakeTimeProvider.cs   fake  – controllable clock
│   │   ├── TestDoubles/ReservationBuilder.cs test-data builder
│   │   ├── ReservationPolicyParameterizedTests.cs        full 4×4 state machine, overlap boundaries
│   │   ├── AvailabilitySearchValidatorParameterizedTests.cs  ClassData of invalid requests, boundary values
│   │   ├── ReservationLifecycleServiceMockTests.cs        strict mocks, Verify/Times.Never, spies
│   │   ├── ReservationsControllerMockTests.cs            stubs with out-params, logger verification
│   │   └── MaintenanceAndReferenceParameterizedTests.cs   timezone rules, generated-reference properties
│   └── MutationHardening/                   ← written by the Mutation Testing role
└── identity-service-tests/
    ├── UnitMocking/
    │   ├── TestDoubles/InMemoryUserRepository.cs  fake – stateful in-memory repository
    │   ├── AuthServiceParameterizedMockTests.cs    role × staff-code matrix, login failures
    │   ├── UserServiceFakeRepositoryTests.cs       state-based tests with the fake
    │   └── JwtTokenGeneratorParameterizedTests.cs  claims, expiry, trust settings
    └── MutationHardening/
```

## Techniques used

| Technique | Where | Why |
|---|---|---|
| `[Theory]` + `[InlineData]` | everywhere | one test method, many boundary values |
| `[MemberData]` generated data | `FullTransitionMatrix()` builds all 16 status pairs | the whole state machine is tested, not hand-picked cases |
| `[ClassData]` | `InvalidRequests` (14 invalid booking requests) | complex objects plus a scenario name per row |
| **Stub** | `IAvailabilitySearchValidator` returning canned `out` values via a custom delegate | drive the controller down a chosen path |
| **Mock** (strict) | `MockBehavior.Strict` repository in `ReservationLifecycleServiceMockTests` | any unexpected DB call fails the test, which proves short-circuiting |
| **Spy** | `Callback<…>(…)` captures the `ReservationCreationCommand` / persisted `User` | assert on what would have been sent to MySQL |
| **Fake** | `FakeTimeProvider`, `InMemoryUserRepository` | working lightweight implementations for state-based tests |
| Interaction verification | `Verify(..., Times.Never)`, `VerifyNoOtherCalls()` | e.g. a token is never issued for a failed login; no hash/insert for a duplicate email |
| Logger verification | `ILogger.Log(LogLevel.Error, …, failure, …)` | infrastructure failures are logged |
| Test Data Builder | `ReservationBuilder.AReservation().WithStatus(...).Build()` | readable arrange blocks |

## Run

```bash
./scripts/run-pipeline.sh unit                                   # all unit tests + coverage report
dotnet test tests/unit/reservation-service-tests --filter "Suite=UnitMocking"
dotnet test tests/unit/identity-service-tests   --filter "Suite=UnitMocking"
dotnet test tests/unit/reservation-service-tests --filter "FullyQualifiedName~ReservationsControllerMockTests" --logger "console;verbosity=detailed"
```

Outputs: `artifacts/unit/*.trx` (test results) and `artifacts/coverage/report/index.html` (coverage).

## Numbers (local run)

| Project | All tests | of which UnitMocking | of which MutationHardening |
|---|---:|---:|---:|
| reservation-service-tests | 325 | 133 | 16 |
| identity-service-tests | 89 | 51 | 7 |

## Viva notes

- **Mock vs stub:** a stub only supplies answers (the validator's `out` values). A mock is also *verified* (`_creation.VerifyNoOtherCalls()`). A spy records the real arguments, and a fake is a working simplified implementation.
- **Why a strict mock for the lifecycle service:** the test asserts *absence* of behaviour. An unknown target status must never reach the database, and a strict mock turns any call into a failure.
- **Why the clock is faked:** booking rules depend on "now" in Asia/Colombo (UTC+05:30). With `TimeProvider.System` the tests would pass or fail depending on when CI runs. The test at 12:00 local / 06:30 UTC catches a UTC-vs-local bug.
- **Ownership comes from the JWT:** `CreateReservation_BuildsCommandFromTokenClaimAndValidatedPeriod` proves the customer id is taken from the `NameIdentifier` claim, never from the request body.
