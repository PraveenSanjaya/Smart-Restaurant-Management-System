using ReservationService.Models;
using Xunit;

namespace ReservationServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// Pure domain rules tested exhaustively with parameterized data (MemberData / InlineData).
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class ReservationPolicyParameterizedTests
{
    private static readonly string[] AllStatuses =
        [ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Cancelled, ReservationStatus.Completed];

    private static readonly HashSet<(string From, string To)> LegalTransitions =
    [
        (ReservationStatus.Pending, ReservationStatus.Confirmed),
        (ReservationStatus.Pending, ReservationStatus.Cancelled),
        (ReservationStatus.Confirmed, ReservationStatus.Cancelled),
        (ReservationStatus.Confirmed, ReservationStatus.Completed)
    ];

    /// <summary>Generates the full 4 x 4 state-transition table (16 cases) instead of hand-picking a few.</summary>
    public static TheoryData<string, string, bool> FullTransitionMatrix()
    {
        var data = new TheoryData<string, string, bool>();
        foreach (var from in AllStatuses)
            foreach (var to in AllStatuses)
                data.Add(from, to, LegalTransitions.Contains((from, to)));
        return data;
    }

    [Theory]
    [MemberData(nameof(FullTransitionMatrix))]
    public void StatusTransition_MatchesLifecycleStateMachine(string from, string to, bool expected) =>
        Assert.Equal(expected, ReservationStatusTransitionPolicy.IsAllowed(from, to));

    [Theory]
    [InlineData("pending", "Confirmed")]   // status names are case-sensitive constants
    [InlineData("Pending", "CONFIRMED")]
    [InlineData("", "Confirmed")]
    [InlineData("Pending", "")]
    [InlineData("Archived", "Pending")]
    [InlineData("Pending", "NoShow")]
    public void StatusTransition_RejectsUnknownOrMiscasedStatuses(string from, string to) =>
        Assert.False(ReservationStatusTransitionPolicy.IsAllowed(from, to));

    [Theory]
    [InlineData("Pending", true)]
    [InlineData("Confirmed", true)]
    [InlineData("Cancelled", true)]
    [InlineData("Completed", true)]
    [InlineData("pending", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    [InlineData("NoShow", false)]
    public void IsKnown_AcceptsOnlyTheFourCanonicalStatuses(string? status, bool expected) =>
        Assert.Equal(expected, ReservationStatus.IsKnown(status));

    // Existing booking used by every overlap case: 18:00 – 20:00.
    private static readonly DateTime ExistingStart = new(2030, 1, 1, 18, 0, 0);
    private static readonly DateTime ExistingEnd = new(2030, 1, 1, 20, 0, 0);

    [Theory]
    [InlineData("16:00", "18:00", false)] // back-to-back before: half-open interval => no clash
    [InlineData("20:00", "22:00", false)] // back-to-back after
    [InlineData("15:00", "17:59", false)] // completely before
    [InlineData("20:01", "21:00", false)] // completely after
    [InlineData("17:00", "18:01", true)]  // one-minute overlap at the start
    [InlineData("19:59", "21:00", true)]  // one-minute overlap at the end
    [InlineData("18:30", "19:30", true)]  // requested inside existing
    [InlineData("17:00", "21:00", true)]  // requested encloses existing
    [InlineData("18:00", "20:00", true)]  // identical period
    public void Overlap_UsesHalfOpenIntervalsForActiveBookings(string requestedStart, string requestedEnd, bool blocks)
    {
        var start = ExistingStart.Date + TimeSpan.Parse(requestedStart);
        var end = ExistingStart.Date + TimeSpan.Parse(requestedEnd);

        Assert.Equal(blocks, ReservationOverlapPolicy.Blocks(ExistingStart, ExistingEnd, start, end, ReservationStatus.Confirmed));
        Assert.Equal(blocks, ReservationOverlapPolicy.Blocks(ExistingStart, ExistingEnd, start, end, ReservationStatus.Pending));
    }

    [Theory]
    [InlineData(ReservationStatus.Pending, true)]
    [InlineData(ReservationStatus.Confirmed, true)]
    [InlineData(ReservationStatus.Cancelled, false)] // cancelled bookings free the table
    [InlineData(ReservationStatus.Completed, false)] // finished bookings never block
    [InlineData("Unknown", false)]
    public void Overlap_OnlyPendingAndConfirmedBookingsBlockTheTable(string existingStatus, bool blocks) =>
        Assert.Equal(blocks, ReservationOverlapPolicy.Blocks(ExistingStart, ExistingEnd, ExistingStart, ExistingEnd, existingStatus));

    [Fact]
    public void Overlap_IsSymmetricForActiveBookings()
    {
        var a = (Start: new DateTime(2030, 1, 1, 18, 0, 0), End: new DateTime(2030, 1, 1, 19, 0, 0));
        var b = (Start: new DateTime(2030, 1, 1, 18, 30, 0), End: new DateTime(2030, 1, 1, 20, 0, 0));

        Assert.Equal(
            ReservationOverlapPolicy.Blocks(a.Start, a.End, b.Start, b.End, ReservationStatus.Confirmed),
            ReservationOverlapPolicy.Blocks(b.Start, b.End, a.Start, a.End, ReservationStatus.Confirmed));
    }
}
