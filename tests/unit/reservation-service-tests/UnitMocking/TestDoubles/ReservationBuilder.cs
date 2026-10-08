using ReservationService.Models;

namespace ReservationServiceTests.UnitMocking.TestDoubles;

/// <summary>Test Data Builder: keeps each test focused on the one field it cares about.</summary>
public sealed class ReservationBuilder
{
    private int _id = 101;
    private int _customerId = 7;
    private int _tableId = 3;
    private string _status = ReservationStatus.Pending;
    private DateTime _start = new(2030, 1, 1, 18, 0, 0);
    private int _durationMinutes = 90;
    private int _guests = 4;

    public static ReservationBuilder AReservation() => new();

    public ReservationBuilder WithId(int id) { _id = id; return this; }
    public ReservationBuilder OwnedBy(int customerId) { _customerId = customerId; return this; }
    public ReservationBuilder OnTable(int tableId) { _tableId = tableId; return this; }
    public ReservationBuilder WithStatus(string status) { _status = status; return this; }
    public ReservationBuilder StartingAt(DateTime start) { _start = start; return this; }
    public ReservationBuilder ForMinutes(int minutes) { _durationMinutes = minutes; return this; }
    public ReservationBuilder ForGuests(int guests) { _guests = guests; return this; }

    public Reservation Build() => new()
    {
        Id = _id,
        CustomerId = _customerId,
        TableId = _tableId,
        TableNumber = $"T{_tableId}",
        BookingReference = "SR-ABCD-2345",
        StartDateTime = _start,
        EndDateTime = _start.AddMinutes(_durationMinutes),
        GuestCount = _guests,
        Status = _status,
        CreatedAt = new DateTime(2029, 12, 1, 8, 0, 0, DateTimeKind.Utc),
        UpdatedAt = new DateTime(2029, 12, 1, 8, 0, 0, DateTimeKind.Utc)
    };
}
