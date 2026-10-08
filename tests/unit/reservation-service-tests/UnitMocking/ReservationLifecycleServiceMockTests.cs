using Moq;
using ReservationService.Models;
using ReservationService.Repositories;
using ReservationService.Services;
using ReservationServiceTests.UnitMocking.TestDoubles;
using Xunit;

namespace ReservationServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// The repository (MySQL) is replaced by a <b>strict mock</b>: any call the test did not set up
/// fails the test, which proves the service short-circuits before touching the database.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class ReservationLifecycleServiceMockTests
{
    private const int ReservationId = 55;
    private readonly Mock<IReservationRepository> _repository = new(MockBehavior.Strict);
    private readonly ReservationLifecycleService _sut;

    public ReservationLifecycleServiceMockTests() => _sut = new ReservationLifecycleService(_repository.Object);

    [Theory]
    [InlineData("Pending", "Confirmed", null)]
    [InlineData("Pending", "Cancelled", null)]
    [InlineData("Confirmed", "Cancelled", 7)]
    [InlineData("Confirmed", "Completed", 7)]
    public async Task ChangeStatus_LegalTransition_PersistsWithOptimisticConcurrencyGuard(string current, string target, int? customerId)
    {
        _repository.Setup(r => r.GetStatusAsync(ReservationId, customerId, It.IsAny<CancellationToken>())).ReturnsAsync(current);
        _repository.Setup(r => r.UpdateStatusAsync(ReservationId, customerId, current, target, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var outcome = await _sut.ChangeStatusAsync(ReservationId, customerId, target);

        Assert.Equal(ReservationStatusUpdateOutcome.Updated, outcome);
        // The *observed* status is passed back so the SQL UPDATE only succeeds if nobody changed it meanwhile.
        _repository.Verify(r => r.UpdateStatusAsync(ReservationId, customerId, current, target, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("Cancelled", "Confirmed")]
    [InlineData("Completed", "Cancelled")]
    [InlineData("Pending", "Completed")]
    [InlineData("Confirmed", "Pending")]
    [InlineData("Pending", "Pending")]
    public async Task ChangeStatus_IllegalTransition_ReturnsConflictWithoutWriting(string current, string target)
    {
        _repository.Setup(r => r.GetStatusAsync(ReservationId, null, It.IsAny<CancellationToken>())).ReturnsAsync(current);

        var outcome = await _sut.ChangeStatusAsync(ReservationId, null, target);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
        _repository.Verify(r => r.UpdateStatusAsync(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("Archived")]
    [InlineData("confirmed")]
    [InlineData("")]
    public async Task ChangeStatus_UnknownTarget_ShortCircuitsBeforeAnyDatabaseCall(string target)
    {
        // Strict mock with no setups: any repository call would throw MockException.
        var outcome = await _sut.ChangeStatusAsync(ReservationId, null, target);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
        _repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ChangeStatus_ReservationMissingOrOwnedBySomeoneElse_ReturnsNotFound()
    {
        _repository.Setup(r => r.GetStatusAsync(ReservationId, 99, It.IsAny<CancellationToken>())).ReturnsAsync((string?)null);

        var outcome = await _sut.ChangeStatusAsync(ReservationId, 99, ReservationStatus.Cancelled);

        Assert.Equal(ReservationStatusUpdateOutcome.NotFound, outcome);
        _repository.Verify(r => r.GetStatusAsync(ReservationId, 99, It.IsAny<CancellationToken>()), Times.Once);
        _repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ChangeStatus_LostConcurrentRace_ReturnsConflict()
    {
        // Stub simulates another admin changing the row between our read and our write.
        _repository.Setup(r => r.GetStatusAsync(ReservationId, null, It.IsAny<CancellationToken>())).ReturnsAsync(ReservationStatus.Pending);
        _repository.Setup(r => r.UpdateStatusAsync(ReservationId, null, ReservationStatus.Pending, ReservationStatus.Confirmed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var outcome = await _sut.ChangeStatusAsync(ReservationId, null, ReservationStatus.Confirmed);

        Assert.Equal(ReservationStatusUpdateOutcome.Conflict, outcome);
    }

    [Fact]
    public async Task ChangeStatus_ForwardsCancellationTokenToRepository()
    {
        using var cts = new CancellationTokenSource();
        CancellationToken seen = default;
        _repository.Setup(r => r.GetStatusAsync(ReservationId, null, It.IsAny<CancellationToken>()))
            .Callback<int, int?, CancellationToken>((_, _, token) => seen = token)   // spy on the argument
            .ReturnsAsync((string?)null);

        await _sut.ChangeStatusAsync(ReservationId, null, ReservationStatus.Confirmed, cts.Token);

        Assert.Equal(cts.Token, seen);
    }

    [Theory]
    [InlineData(ReservationCancellationOutcome.Cancelled)]
    [InlineData(ReservationCancellationOutcome.NotFound)]
    [InlineData(ReservationCancellationOutcome.InvalidState)]
    public async Task CancelForCustomer_DelegatesToAtomicRepositoryOperation(ReservationCancellationOutcome repositoryOutcome)
    {
        var reservation = ReservationBuilder.AReservation().WithId(ReservationId).OwnedBy(7).WithStatus(ReservationStatus.Cancelled).Build();
        var expected = new ReservationCancellationResult(repositoryOutcome, repositoryOutcome == ReservationCancellationOutcome.Cancelled ? reservation : null);
        _repository.Setup(r => r.CancelForCustomerAtomicallyAsync(ReservationId, 7, It.IsAny<CancellationToken>())).ReturnsAsync(expected);

        var result = await _sut.CancelForCustomerAsync(ReservationId, 7);

        Assert.Same(expected, result);
        _repository.Verify(r => r.CancelForCustomerAtomicallyAsync(ReservationId, 7, It.IsAny<CancellationToken>()), Times.Once);
        _repository.VerifyNoOtherCalls();
    }
}
