using IdentityService.DTOs;
using IdentityService.Services;
using IdentityServiceTests.UnitMocking.TestDoubles;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IdentityServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// Uses a stateful <see cref="InMemoryUserRepository"/> <b>fake</b> rather than a mock so the
/// test asserts on resulting state, not on a script of calls.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class UserServiceFakeRepositoryTests
{
    private readonly InMemoryUserRepository _repository = new();
    private readonly UserService _sut;

    public UserServiceFakeRepositoryTests() => _sut = new UserService(_repository, NullLogger<UserService>.Instance);

    private static UpdateProfileRequestDto Update(string email, string name = "  Amaya Silva ", string? phone = null) =>
        new() { FullName = name, Email = email, PhoneNumber = phone };

    [Theory]
    [InlineData("amaya@bistro.lk", "amaya@bistro.lk")]          // unchanged email
    [InlineData("AMAYA@Bistro.lk", "amaya@bistro.lk")]          // same email, different case is not a conflict
    [InlineData("  amaya.new@bistro.lk ", "amaya.new@bistro.lk")] // new free email is normalised
    public async Task UpdateProfile_AllowedEmails_ArePersistedNormalised(string requestedEmail, string storedEmail)
    {
        var amaya = _repository.Seed("Amaya", "amaya@bistro.lk");
        _repository.Seed("Other", "other@bistro.lk");

        var result = await _sut.UpdateProfileAsync(amaya.UserId, Update(requestedEmail));

        Assert.Equal(storedEmail, result.Email);
        Assert.Equal("Amaya Silva", result.FullName);
        Assert.Equal(storedEmail, (await _repository.GetByIdAsync(amaya.UserId))!.Email);
    }

    [Theory]
    [InlineData("other@bistro.lk")]
    [InlineData("OTHER@BISTRO.LK")]
    [InlineData(" other@bistro.lk ")]
    public async Task UpdateProfile_EmailOwnedByAnotherAccount_IsRejectedAndNothingIsWritten(string requestedEmail)
    {
        var amaya = _repository.Seed("Amaya", "amaya@bistro.lk");
        _repository.Seed("Other", "other@bistro.lk");

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.UpdateProfileAsync(amaya.UserId, Update(requestedEmail)));

        Assert.Equal(0, _repository.UpdateCalls);
        Assert.Equal("amaya@bistro.lk", (await _repository.GetByIdAsync(amaya.UserId))!.Email);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(" 0712345678 ", "0712345678")]
    public async Task UpdateProfile_BlankPhoneIsStoredAsNull(string? phone, string? expected)
    {
        var amaya = _repository.Seed("Amaya", "amaya@bistro.lk");

        var result = await _sut.UpdateProfileAsync(amaya.UserId, Update("amaya@bistro.lk", phone: phone));

        Assert.Equal(expected, result.PhoneNumber);
    }

    [Fact]
    public async Task UpdateProfile_UnknownUser_ThrowsKeyNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _sut.UpdateProfileAsync(404, Update("ghost@bistro.lk")));
        Assert.Equal(0, _repository.UpdateCalls);
    }

    [Fact]
    public async Task GetProfile_MapsEveryPublicFieldAndNeverExposesThePasswordHash()
    {
        var user = _repository.Seed("Chef Ravi", "ravi@bistro.lk", role: "KitchenStaff", passwordHash: "$2a$11$secret");

        var dto = await _sut.GetProfileAsync(user.UserId);

        Assert.NotNull(dto);
        Assert.Equal((user.UserId, "Chef Ravi", "ravi@bistro.lk"), (dto!.UserId, dto.FullName, dto.Email));
        Assert.Equal(["KitchenStaff"], dto.Roles);
        Assert.DoesNotContain(typeof(UserResponseDto).GetProperties(), p => p.Name.Contains("Password", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetProfile_UnknownUser_ReturnsNull() => Assert.Null(await _sut.GetProfileAsync(999));
}
