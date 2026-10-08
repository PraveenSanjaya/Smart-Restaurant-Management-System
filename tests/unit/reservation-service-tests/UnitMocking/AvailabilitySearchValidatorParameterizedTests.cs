using System.Collections;
using Microsoft.Extensions.Options;
using ReservationService.DTOs;
using ReservationService.Models;
using ReservationService.Services;
using ReservationServiceTests.UnitMocking.TestDoubles;
using Xunit;

namespace ReservationServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// The validator depends on "now"; a <see cref="FakeTimeProvider"/> freezes the clock at
/// 2030-01-01 09:00 restaurant time so every boundary below is deterministic.
/// Rules under test (defaults): open 10:00, close 22:00, duration 30–240 minutes, guests ≥ 1.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class AvailabilitySearchValidatorParameterizedTests
{
    internal static readonly DateOnly Today = new(2030, 1, 1);
    internal static readonly DateOnly Tomorrow = Today.AddDays(1);

    private readonly FakeTimeProvider _clock = FakeTimeProvider.AtColomboTime(2030, 1, 1, 9);

    private AvailabilitySearchValidator CreateValidator(AvailabilityRulesOptions? rules = null) =>
        new(_clock, Options.Create(rules ?? new AvailabilityRulesOptions()));

    private static AvailabilitySearchRequestDto Request(DateOnly? date, string? start, int? duration, int? guests) => new()
    {
        Date = date,
        StartTime = start is null ? null : TimeOnly.Parse(start),
        DurationMinutes = duration,
        GuestCount = guests
    };

    /// <summary>ClassData: each row is an invalid request plus the field that must be reported.</summary>
    public sealed class InvalidRequests : IEnumerable<object[]>
    {
        public IEnumerator<object[]> GetEnumerator()
        {
            yield return Case("missing date", Request(null, "12:00", 60, 2), "date");
            yield return Case("missing start", Request(Tomorrow, null, 60, 2), "startTime");
            yield return Case("missing duration", Request(Tomorrow, "12:00", null, 2), "durationMinutes");
            yield return Case("zero duration", Request(Tomorrow, "12:00", 0, 2), "durationMinutes");
            yield return Case("negative duration", Request(Tomorrow, "12:00", -15, 2), "durationMinutes");
            yield return Case("missing guests", Request(Tomorrow, "12:00", 60, null), "guestCount");
            yield return Case("zero guests", Request(Tomorrow, "12:00", 60, 0), "guestCount");
            yield return Case("below min duration (29)", Request(Tomorrow, "12:00", 29, 2), "durationMinutes");
            yield return Case("above max duration (241)", Request(Tomorrow, "12:00", 241, 2), "durationMinutes");
            yield return Case("date in the past", Request(Today.AddDays(-1), "12:00", 60, 2), "date");
            yield return Case("earlier today", Request(Today, "08:30", 60, 2), "startTime");
            yield return Case("before opening", Request(Tomorrow, "09:59", 60, 2), "startTime");
            yield return Case("ends after closing", Request(Tomorrow, "21:00", 90, 2), "startTime");
            yield return Case("crosses midnight", Request(Tomorrow, "23:30", 60, 2), "startTime");
        }

        private static object[] Case(string name, AvailabilitySearchRequestDto request, string field) => [name, request, field];
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    [Theory]
    [ClassData(typeof(InvalidRequests))]
    public void TryValidate_InvalidRequest_ReportsFieldAndReturnsNoCriteria(string scenario, AvailabilitySearchRequestDto request, string expectedField)
    {
        var ok = CreateValidator().TryValidate(request, out var criteria, out var errors);

        Assert.False(ok, scenario);
        Assert.Null(criteria);
        Assert.True(errors.ContainsKey(expectedField), $"{scenario}: expected an error for '{expectedField}' but got [{string.Join(", ", errors.Keys)}]");
        Assert.All(errors.Values, messages => Assert.NotEmpty(messages));
    }

    [Theory]
    [InlineData("2030-01-01", "10:00", 30, 1, "2030-01-01T10:00", "2030-01-01T10:30")] // opens exactly; min duration; min guests
    [InlineData("2030-01-01", "21:30", 30, 2, "2030-01-01T21:30", "2030-01-01T22:00")] // ends exactly at closing
    [InlineData("2030-01-02", "18:00", 240, 12, "2030-01-02T18:00", "2030-01-02T22:00")] // max duration
    [InlineData("2030-06-15", "13:15", 95, 6, "2030-06-15T13:15", "2030-06-15T14:50")]  // arbitrary future date
    public void TryValidate_BoundaryValidRequests_ProduceExactCriteria(
        string date, string start, int duration, int guests, string expectedStart, string expectedEnd)
    {
        var request = Request(DateOnly.Parse(date), start, duration, guests);

        var ok = CreateValidator().TryValidate(request, out var criteria, out var errors);

        Assert.True(ok, string.Join("; ", errors.SelectMany(e => e.Value)));
        Assert.Empty(errors);
        Assert.Equal(DateTime.Parse(expectedStart), criteria!.RequestedStart);
        Assert.Equal(DateTime.Parse(expectedEnd), criteria.RequestedEnd);
        Assert.Equal(guests, criteria.GuestCount);
        Assert.Equal(DateTimeKind.Unspecified, criteria.RequestedStart.Kind); // restaurant-local wall clock, never UTC
    }

    [Fact]
    public void TryValidate_NullRequest_ReportsEveryRequiredField()
    {
        var ok = CreateValidator().TryValidate(null, out _, out var errors);

        Assert.False(ok);
        Assert.Equal(new[] { "date", "durationMinutes", "guestCount", "startTime" }, errors.Keys.Order());
    }

    [Fact]
    public void TryValidate_SameRequestBecomesInvalidOnceTheClockPassesIt()
    {
        var validator = CreateValidator();
        var request = Request(Today, "10:00", 60, 2);
        Assert.True(validator.TryValidate(request, out _, out _));

        _clock.Advance(TimeSpan.FromMinutes(61)); // now 10:01 restaurant time

        Assert.False(validator.TryValidate(request, out _, out var errors));
        Assert.Contains("startTime", errors.Keys);
    }

    [Theory]
    [InlineData(60, 120, 59, false)]
    [InlineData(60, 120, 60, true)]
    [InlineData(60, 120, 120, true)]
    [InlineData(60, 120, 121, false)]
    public void TryValidate_HonoursConfiguredDurationLimits(int min, int max, int requested, bool valid)
    {
        var validator = CreateValidator(new AvailabilityRulesOptions { MinimumDurationMinutes = min, MaximumDurationMinutes = max });

        Assert.Equal(valid, validator.TryValidate(Request(Tomorrow, "12:00", requested, 2), out _, out _));
    }

    [Theory]
    [InlineData("10am", "22:00")]
    [InlineData("10:00", "25:00")]
    [InlineData("", "22:00")]
    public void TryValidate_MisconfiguredOpeningHours_FailsFast(string opening, string closing)
    {
        var validator = CreateValidator(new AvailabilityRulesOptions { OpeningTime = opening, ClosingTime = closing });

        Assert.Throws<InvalidOperationException>(() => validator.TryValidate(Request(Tomorrow, "12:00", 60, 2), out _, out _));
    }
}
