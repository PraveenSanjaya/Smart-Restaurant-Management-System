# Mutation Testing

**Owner:** H. L. P. S. Perera (IT24101848) · **Tool:** Stryker.NET 5 (`dotnet stryker`, pinned in `dotnet-tools.json`)

Coverage only shows that code *ran*. Mutation testing checks that the tests would *notice* if the code were wrong. Stryker makes small faults ("mutants") in the production code, for example `<` → `<=`, `||` → `&&`, removed statements, emptied strings or `a ?? b` → `b`. It then runs the unit tests against each mutant:

| Status | Meaning |
|---|---|
| **Killed** | at least one test failed → the tests detect this fault ✅ |
| **Survived** | all tests still passed → a gap in the test suite ❌ |
| **NoCoverage** | no test even executes the mutated line ❌ |
| Timeout | the mutant caused an infinite loop; counted as detected |
| CompileError / Ignored | not counted |

**Mutation score** = (killed + timeout) / (killed + timeout + survived + no coverage).

## Configuration

| File | Mutated code | Tests |
|---|---|---|
| `stryker-reservation.json` | reservation domain: status state machine, overlap policy, availability validator, lifecycle service, maintenance policy, booking reference generator, event factory | `reservation-service-tests` |
| `stryker-identity.json` | `AuthService`, `UserService`, `JwtTokenGenerator`, `BcryptPasswordHasher` | `identity-service-tests` |

Settings and why they were chosen:
- `"mutation-level": "Complete"` uses every mutator, including LINQ, regex, string and null-coalescing mutators.
- `"coverage-analysis": "perTest"` runs only the tests that cover each mutant. That is about 3–4× faster, and mutants with no covering test are reported straight away as NoCoverage.
- `"ignore-methods": ["*Log*"]` skips mutations inside logging calls, which create noise without value.
- `"thresholds": { "high": 85, "low": 70, "break": 60 }`: in CI the job fails if the score drops below 60%.
- Controllers and repositories are out of scope. Controllers are thin HTTP adapters covered by the controller unit tests and the k6 end-to-end checks. Repositories are SQL that needs a real MySQL, so the integration tests cover them.

## Baseline vs hardened: the demo story

The pipeline runs Stryker twice per service:
1. **baseline**: the original suite. The `MutationHardening` tests are excluded with `test-case-filter: Suite!=MutationHardening`.
2. **hardened**: the full suite, including the tests written to kill the survivors.

| Service | Baseline score | Hardened score | Survivors analysed |
|---|---:|---:|---|
| Reservation | **81.51 %** (15 survived, 7 no coverage) | **97.48 %** | 22 |
| Identity | **82.22 %** (8 survived, 8 no coverage) | **100.00 %** | 16 |

What the survivors revealed (each is named in a comment on the test that kills it, under `tests/unit/*/MutationHardening/`):

| Survivor | Weakness in the original tests | Killing test |
|---|---|---|
| `DurationMinutes <= 0` → `< 0`, and the `AddError` statement removed | Duration 0 was still rejected later by the min-duration rule, so the tests only checked "invalid", never *which* message | `NonPositiveDuration_StopsValidationEarlyWithItsOwnMessage` |
| `errors.Count > 0 \|\| request is null…` → `&&` | Early-exit logic was never observed | `InvalidGuestCountWithAPastDate_ReportsOnlyTheRequiredFieldError` |
| `requestedStart < restaurantNow` → `<=` | The "starts exactly now" boundary was never tested | `BookingStartingExactlyNow_IsAccepted` |
| String mutations on every validation message | The React UI shows these strings, but no test asserted them | `EveryRuleReportsItsExactContractMessage` |
| `catch (ArgumentOutOfRangeException)` (NoCoverage) | Overflow past `DateTime.MaxValue` was never exercised; it would have been a 500 | `PeriodOverflowingDateTimeMaxValue_IsAValidationErrorNotACrash` |
| `_configuration["Staff:AuthorizationCode"] ?? "BISTRO2026"` → `"BISTRO2026"` | Tests configured the same value as the default, so "ignore configuration" was undetectable | `ConfiguredStaffCode_ReplacesTheBuiltInDefault` |
| JWT issuer/audience `?? default` mutants | Same root cause | `ConfiguredIssuerAndAudience_AreWrittenIntoTheToken` |
| `UserService` "row vanished" branches (NoCoverage) | Concurrent-delete paths were never tested | `UpdateProfile_RowVanishesDuringUpdate…`, `…UserDeletedBeforeReRead…` |

**Equivalent mutants.** The 3 mutants still alive in the reservation service are all on line 52 of `AvailabilitySearchValidator` (`if (requestedEnd <= requestedStart)`). That branch cannot be reached: the duration has already been checked to be > 0, and an overflow is caught earlier. Mutating unreachable code changes nothing observable, so no test can kill these mutants. Two honest fixes exist: delete the dead check, or keep it as defence in depth and accept 97.5%.

## Run

```bash
./scripts/run-pipeline.sh mutation                       # hardened, both services
./scripts/run-pipeline.sh mutation baseline reservation  # original suite only
./scripts/run-pipeline.sh mutation hardened identity     # about 1 minute
```

Reports: `artifacts/mutation/<service>-<mode>/reports/mutation-report.html`. The interactive report shows each mutant inline in the source code. Click a red (survived) mutant to see the exact change.
