using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using MySqlConnector;
using ReservationService.Controllers;
using ReservationService.DTOs;
using ReservationService.Models;
using ReservationService.Services;
using ReservationServiceTests.UnitMocking.TestDoubles;
using Xunit;

namespace ReservationServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// The controller is isolated from validation rules, the database and logging:
///  * <b>stub</b>  – IAvailabilitySearchValidator returns canned out-parameters,
///  * <b>mock</b>  – IReservationCreationService has its interactions verified,
///  * <b>spy</b>   – a Callback captures the command the controller builds,
///  * <b>mock</b>  – ILogger is verified to record an Error on failure.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class ReservationsControllerMockTests
{
    private delegate bool TryValidateDelegate(AvailabilitySearchRequestDto? request, out AvailabilitySearchCriteria? criteria, out Dictionary<string, string[]> errors);

    private static readonly AvailabilitySearchCriteria ValidPeriod = new(new DateTime(2030, 1, 2, 18, 0, 0), new DateTime(2030, 1, 2, 19, 30, 0), 4);

    private readonly Mock<IAvailabilitySearchValidator> _validator = new();
    private readonly Mock<IReservationCreationService> _creation = new();
    private readonly Mock<ILogger<ReservationsController>> _logger = new();

    private static CreateReservationRequestDto ValidBody(int? tableId = 3) => new()
    {
        TableId = tableId,
        Date = new DateOnly(2030, 1, 2),
        StartTime = new TimeOnly(18, 0),
        DurationMinutes = 90,
        GuestCount = 4
    };

    private void StubValidatorAccepts() =>
        _validator.Setup(v => v.TryValidate(It.IsAny<AvailabilitySearchRequestDto?>(), out It.Ref<AvailabilitySearchCriteria?>.IsAny, out It.Ref<Dictionary<string, string[]>>.IsAny))
            .Returns(new TryValidateDelegate((AvailabilitySearchRequestDto? _, out AvailabilitySearchCriteria? criteria, out Dictionary<string, string[]> errors) =>
            {
                criteria = ValidPeriod;
                errors = new Dictionary<string, string[]>();
                return true;
            }));

    private void StubValidatorRejects(string field, string message) =>
        _validator.Setup(v => v.TryValidate(It.IsAny<AvailabilitySearchRequestDto?>(), out It.Ref<AvailabilitySearchCriteria?>.IsAny, out It.Ref<Dictionary<string, string[]>>.IsAny))
            .Returns(new TryValidateDelegate((AvailabilitySearchRequestDto? _, out AvailabilitySearchCriteria? criteria, out Dictionary<string, string[]> errors) =>
            {
                criteria = null;
                errors = new Dictionary<string, string[]> { [field] = [message] };
                return false;
            }));

    private ReservationsController CreateController(string? userId = "7")
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, AppRoles.Customer) };
        if (userId is not null) claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));

        return new ReservationsController(_validator.Object, Mock.Of<IAvailabilitySearchService>(), _creation.Object, _logger.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) }
            }
        };
    }

    public static TheoryData<ReservationCreateOutcome, int> OutcomeToStatusCode => new()
    {
        { ReservationCreateOutcome.Created, StatusCodes.Status201Created },
        { ReservationCreateOutcome.Replayed, StatusCodes.Status200OK },          // idempotent retry
        { ReservationCreateOutcome.TableNotFound, StatusCodes.Status404NotFound },
        { ReservationCreateOutcome.Unavailable, StatusCodes.Status409Conflict }  // double-booking prevented
    };

    [Theory]
    [MemberData(nameof(OutcomeToStatusCode))]
    public async Task CreateReservation_MapsEveryServiceOutcomeToTheCorrectHttpStatus(ReservationCreateOutcome outcome, int expectedStatus)
    {
        StubValidatorAccepts();
        var reservation = outcome is ReservationCreateOutcome.Created or ReservationCreateOutcome.Replayed
            ? ReservationBuilder.AReservation().OnTable(3).Build()
            : null;
        _creation.Setup(s => s.CreateAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationCreateResult(outcome, reservation));

        var result = await CreateController().CreateReservation(ValidBody(), "key-1");

        Assert.Equal(expectedStatus, StatusOf(result));
    }

    [Theory]
    [InlineData("abc-123", "abc-123")]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)] // whitespace keys are treated as "no key"
    public async Task CreateReservation_BuildsCommandFromTokenClaimAndValidatedPeriod(string? headerKey, string? expectedKey)
    {
        StubValidatorAccepts();
        ReservationCreationCommand? captured = null;
        _creation.Setup(s => s.CreateAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>()))
            .Callback<ReservationCreationCommand, CancellationToken>((command, _) => captured = command)
            .ReturnsAsync(new ReservationCreateResult(ReservationCreateOutcome.Created, ReservationBuilder.AReservation().Build()));

        await CreateController(userId: "42").CreateReservation(ValidBody(tableId: 9), headerKey);

        Assert.NotNull(captured);
        Assert.Equal(42, captured!.CustomerId);   // owner comes from the JWT, never from the request body
        Assert.Equal(9, captured.TableId);
        Assert.Same(ValidPeriod, captured.Period);
        Assert.Equal(expectedKey, captured.IdempotencyKey);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-4)]
    public async Task CreateReservation_InvalidTableId_Returns400AndNeverCallsService(int? tableId)
    {
        var result = await CreateController().CreateReservation(ValidBody(tableId), null);

        Assert.Equal(StatusCodes.Status400BadRequest, StatusOf(result));
        _creation.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateReservation_OverlongIdempotencyKey_Returns400()
    {
        var result = await CreateController().CreateReservation(ValidBody(), new string('k', 65));

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Contains("idempotencyKey", problem.Errors.Keys);
        _creation.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CreateReservation_ValidatorRejection_IsSurfacedAsValidationProblem()
    {
        StubValidatorRejects("startTime", "Bookings must be within restaurant hours.");

        var result = await CreateController().CreateReservation(ValidBody(), null);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<BadRequestObjectResult>(result).Value);
        Assert.Equal(["Bookings must be within restaurant hours."], problem.Errors["startTime"]);
        _creation.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-number")]
    [InlineData("0")]
    [InlineData("-3")]
    public async Task CreateReservation_MissingOrInvalidUserClaim_Returns401(string? userId)
    {
        StubValidatorAccepts();

        var result = await CreateController(userId).CreateReservation(ValidBody(), null);

        Assert.IsType<UnauthorizedResult>(result);
        _creation.VerifyNoOtherCalls();
    }

    public static TheoryData<Exception> InfrastructureFailures => new()
    {
        new InvalidOperationException("connection pool exhausted"),
        new TimeoutException("db timeout"),
        CreateMySqlException()
    };

    [Theory]
    [MemberData(nameof(InfrastructureFailures))]
    public async Task CreateReservation_InfrastructureFailure_Returns500AndLogsError(Exception failure)
    {
        StubValidatorAccepts();
        _creation.Setup(s => s.CreateAsync(It.IsAny<ReservationCreationCommand>(), It.IsAny<CancellationToken>())).ThrowsAsync(failure);

        var result = await CreateController().CreateReservation(ValidBody(), null);

        Assert.Equal(StatusCodes.Status500InternalServerError, StatusOf(result));
        _logger.Verify(l => l.Log(
            LogLevel.Error,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            failure,
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    private static int? StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode,
        StatusCodeResult s => s.StatusCode,
        _ => null
    };

    private static MySqlException CreateMySqlException()
    {
        // MySqlException has no public constructor; the internal one is reached via reflection for test purposes.
        var ctor = typeof(MySqlException).GetConstructors(System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
            .First(c => c.GetParameters() is [{ ParameterType: var p }] && p == typeof(string));
        return (MySqlException)ctor.Invoke(["Deadlock found when trying to get lock"]);
    }
}
