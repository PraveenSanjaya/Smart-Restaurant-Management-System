using Microsoft.Extensions.Options;
using ReservationService.DTOs;
using ReservationService.Models;
using ReservationService.Services;
using ReservationServiceTests.UnitMocking.TestDoubles;
using Xunit;

namespace ReservationServiceTests.MutationHardening;

/// <summary>
/// SE3112 – Mutation Testing.
/// Each test below was written to kill a specific mutant that <b>survived</b> the first Stryker.NET run
/// (see tests/mutation/README.md, "Baseline vs hardened"). The comment on each test names the mutant.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "MutationHardening")]
public sealed class AvailabilityValidatorMutationHardeningTests
{
    private static AvailabilitySearchValidator Validator(FakeTimeProvider clock, AvailabilityRulesOptions? rules = null) =>
        new(clock, Options.Create(rules ?? new AvailabilityRulesOptions()));

    private static readonly FakeTimeProvider NineAm = FakeTimeProvider.AtColomboTime(2030, 1, 1, 9);
    private static readonly DateOnly Tomorrow = new(2030, 1, 2);

    private static AvailabilitySearchRequestDto Request(DateOnly? date, string? start, int? duration, int? guests) => new()
    {
        Date = date,
        StartTime = start is null ? null : TimeOnly.Parse(start),
        DurationMinutes = duration,
        GuestCount = guests
    };

    // Kills: String mutations on every user-facing message (L26–L31, L37, L48, L50, L54).
    // The API contract is "field -> exact message"; the React form renders these strings verbatim.
    [Theory]
    [InlineData(null, "12:00", 60, 2, "date", "Date is required and must use YYYY-MM-DD.")]
    [InlineData("2030-01-02", null, 60, 2, "startTime", "Start time is required and must use HH:mm.")]
    [InlineData("2030-01-02", "12:00", null, 2, "durationMinutes", "Duration is required.")]
    [InlineData("2030-01-02", "12:00", 60, null, "guestCount", "Guest count is required.")]
    [InlineData("2030-01-02", "12:00", 60, 0, "guestCount", "Guest count must be at least 1.")]
    [InlineData("2030-01-02", "12:00", 300, 2, "durationMinutes", "Duration must be between 30 and 240 minutes.")]
    [InlineData("2029-12-31", "12:00", 60, 2, "date", "The requested date must not be in the past.")]
    [InlineData("2030-01-02", "21:30", 60, 2, "startTime", "Bookings must be within restaurant hours (10:00–22:00) and cannot cross midnight.")]
    public void EveryRuleReportsItsExactContractMessage(string? date, string? start, int? duration, int? guests, string field, string message)
    {
        var request = Request(date is null ? null : DateOnly.Parse(date), start, duration, guests);

        Validator(NineAm).TryValidate(request, out _, out var errors);

        Assert.Equal([message], errors[field]);
    }

    // Kills: Equality mutation L29 (`<= 0` -> `< 0`), Statement mutation L29 (AddError removed)
    // and Logical mutation L33 (`||` -> `&&`). All three let a zero/negative duration fall through
    // to the range check, which would overwrite the message with "Duration must be between ...".
    [Theory]
    [InlineData(0)]
    [InlineData(-30)]
    public void NonPositiveDuration_StopsValidationEarlyWithItsOwnMessage(int duration)
    {
        Validator(NineAm).TryValidate(Request(Tomorrow, "12:00", duration, 2), out var criteria, out var errors);

        Assert.Null(criteria);
        Assert.Equal(["Duration must be greater than zero."], errors["durationMinutes"]);
        Assert.Single(errors);
    }

    // Kills: Logical mutation L33 for the guest-count branch – validation must stop before
    // the clock/opening-hours rules run, so only the guestCount error is reported.
    [Fact]
    public void InvalidGuestCountWithAPastDate_ReportsOnlyTheRequiredFieldError()
    {
        Validator(NineAm).TryValidate(Request(new DateOnly(2020, 1, 1), "12:00", 60, 0), out _, out var errors);

        Assert.Equal(["guestCount"], errors.Keys);
    }

    // Kills: String mutation L50. The clock is mid-afternoon so the past start is still inside opening hours
    // (otherwise the opening-hours rule would overwrite the startTime message).
    [Fact]
    public void StartEarlierToday_ReportsThePastStartMessage()
    {
        var threePm = FakeTimeProvider.AtColomboTime(2030, 1, 1, 15);

        Validator(threePm).TryValidate(Request(new DateOnly(2030, 1, 1), "12:00", 60, 2), out _, out var errors);

        Assert.Equal(["The requested start time must not be in the past."], errors["startTime"]);
    }

    // Kills: Equality mutation L49 (`requestedStart < restaurantNow` -> `<=`).
    // A booking that starts at exactly "now" (10:00 sharp, opening time) is still bookable.
    [Fact]
    public void BookingStartingExactlyNow_IsAccepted()
    {
        var tenAm = FakeTimeProvider.AtColomboTime(2030, 1, 1, 10);

        var ok = Validator(tenAm).TryValidate(Request(new DateOnly(2030, 1, 1), "10:00", 30, 2), out var criteria, out var errors);

        Assert.True(ok, string.Join("; ", errors.SelectMany(e => e.Value)));
        Assert.Equal(new DateTime(2030, 1, 1, 10, 0, 0), criteria!.RequestedStart);
    }

    // Covers L44 (previously NoCoverage): DateTime.AddMinutes overflowing past 9999-12-31
    // must become a validation error, never an unhandled 500.
    [Fact]
    public void PeriodOverflowingDateTimeMaxValue_IsAValidationErrorNotACrash()
    {
        var rules = new AvailabilityRulesOptions { OpeningTime = "00:00", ClosingTime = "23:59" };

        var ok = Validator(NineAm, rules).TryValidate(Request(new DateOnly(9999, 12, 31), "23:30", 60, 2), out var criteria, out var errors);

        Assert.False(ok);
        Assert.Null(criteria);
        Assert.Equal(["Duration creates an invalid booking period."], errors["durationMinutes"]);
    }

    // Kills: String mutation L64 – operators rely on the setting name to fix a bad deployment.
    [Theory]
    [InlineData("10am", "22:00", "OpeningTime")]
    [InlineData("10:00", "late", "ClosingTime")]
    public void MisconfiguredHours_NameTheBrokenSetting(string opening, string closing, string setting)
    {
        var validator = Validator(NineAm, new AvailabilityRulesOptions { OpeningTime = opening, ClosingTime = closing });

        var ex = Assert.Throws<InvalidOperationException>(() => validator.TryValidate(Request(Tomorrow, "12:00", 60, 2), out _, out _));

        Assert.Equal($"Reservation availability setting '{setting}' must use HH:mm.", ex.Message);
    }
}
