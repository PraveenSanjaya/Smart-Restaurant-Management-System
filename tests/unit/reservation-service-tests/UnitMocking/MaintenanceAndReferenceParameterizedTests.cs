using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using ReservationService.Models;
using ReservationService.Services;
using ReservationServiceTests.UnitMocking.TestDoubles;
using Xunit;

namespace ReservationServiceTests.UnitMocking;

/// <summary>SE3112 – Unit Testing &amp; Mocking: customer self-service eligibility and booking reference format.</summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed partial class MaintenanceAndReferenceParameterizedTests
{
    // 2030-01-01 12:00 in Colombo == 06:30 UTC. A UTC-based bug would treat 08:00–12:00 local bookings as future.
    private readonly FakeTimeProvider _clock = FakeTimeProvider.AtColomboTime(2030, 1, 1, 12);

    private ReservationMaintenancePolicy Policy() => new(_clock, Options.Create(new AvailabilityRulesOptions()));

    [Theory]
    [InlineData(ReservationStatus.Pending, 60, true)]
    [InlineData(ReservationStatus.Confirmed, 60, true)]
    [InlineData(ReservationStatus.Pending, 1, true)]       // one minute in the future
    [InlineData(ReservationStatus.Pending, 0, false)]      // starting right now is no longer "upcoming"
    [InlineData(ReservationStatus.Confirmed, -1, false)]
    [InlineData(ReservationStatus.Confirmed, -240, false)] // would be "future" if compared against UTC wall clock
    [InlineData(ReservationStatus.Cancelled, 60, false)]
    [InlineData(ReservationStatus.Completed, 60, false)]
    public void CanCustomerMaintain_RequiresActiveStatusAndFutureStartInRestaurantTime(string status, int minutesFromNow, bool expected)
    {
        var reservation = ReservationBuilder.AReservation()
            .WithStatus(status)
            .StartingAt(new DateTime(2030, 1, 1, 12, 0, 0).AddMinutes(minutesFromNow))
            .Build();

        Assert.Equal(expected, Policy().CanCustomerMaintain(reservation));
    }

    [Theory]
    [InlineData(ReservationStatus.Pending, -120, true, true)]    // admins may fix past, still-active bookings
    [InlineData(ReservationStatus.Confirmed, -120, true, true)]
    [InlineData(ReservationStatus.Cancelled, 120, true, false)]
    [InlineData(ReservationStatus.Completed, 120, true, false)]
    [InlineData(ReservationStatus.Pending, -120, false, false)]  // customers may not
    [InlineData(ReservationStatus.Pending, 120, false, true)]
    public void CanReschedule_AdminsBypassTheTimeRuleButNotTheStatusRule(string status, int minutesFromNow, bool isAdmin, bool expected)
    {
        var reservation = ReservationBuilder.AReservation()
            .WithStatus(status)
            .StartingAt(new DateTime(2030, 1, 1, 12, 0, 0).AddMinutes(minutesFromNow))
            .Build();

        Assert.Equal(expected, Policy().CanReschedule(reservation, isAdmin));
    }

    [Fact]
    public void RestaurantNow_IsUtcPlusFiveThirty_WhileUtcNowStaysUtc()
    {
        var policy = Policy();

        Assert.Equal(new DateTime(2030, 1, 1, 12, 0, 0), policy.RestaurantNow);
        Assert.Equal(new DateTime(2030, 1, 1, 6, 30, 0), policy.UtcNow);
        Assert.Equal(DateTimeKind.Utc, policy.UtcNow.Kind);
    }

    [GeneratedRegex("^SR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")]
    private static partial Regex BookingReferenceFormat();

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(5_000)]
    public void BookingReference_AlwaysMatchesSupportFriendlyFormat(int samples)
    {
        var generator = new BookingReferenceGenerator();

        for (var i = 0; i < samples; i++)
        {
            var reference = generator.Generate();
            Assert.Matches(BookingReferenceFormat(), reference);
        }
    }

    [Theory]
    [InlineData('0')]
    [InlineData('O')]
    [InlineData('1')]
    [InlineData('I')]
    public void BookingReference_NeverContainsVisuallyAmbiguousCharacters(char ambiguous)
    {
        var generator = new BookingReferenceGenerator();
        var body = string.Concat(Enumerable.Range(0, 2_000).Select(_ => generator.Generate()[3..]));

        Assert.DoesNotContain(ambiguous, body);
    }

    [Fact]
    public void BookingReference_IsEffectivelyUniqueAcrossTenThousandBookings()
    {
        var generator = new BookingReferenceGenerator();
        var references = Enumerable.Range(0, 10_000).Select(_ => generator.Generate()).ToList();

        // 32^8 ≈ 1.1e12 combinations: a collision in 10k draws has probability ≈ 4.5e-5.
        Assert.True(references.Distinct().Count() >= 9_999);
    }
}
