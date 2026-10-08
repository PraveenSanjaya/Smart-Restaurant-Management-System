namespace ReservationServiceTests.UnitMocking.TestDoubles;

/// <summary>
/// Hand-written <b>fake</b>: a working, simplified TimeProvider whose clock the test controls.
/// Freezing time makes "past / future" rules deterministic regardless of when CI runs.
/// </summary>
public sealed class FakeTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    private DateTimeOffset _utcNow = utcNow;

    public override DateTimeOffset GetUtcNow() => _utcNow;

    public void Advance(TimeSpan delta) => _utcNow = _utcNow.Add(delta);

    /// <summary>Builds a clock from a restaurant-local (Asia/Colombo, UTC+05:30) wall-clock time.</summary>
    public static FakeTimeProvider AtColomboTime(int year, int month, int day, int hour, int minute = 0) =>
        new(new DateTimeOffset(year, month, day, hour, minute, 0, TimeSpan.FromHours(5.5)));
}
