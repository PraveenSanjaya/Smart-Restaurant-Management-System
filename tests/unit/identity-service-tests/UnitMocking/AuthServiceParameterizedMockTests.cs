using IdentityService.DTOs;
using IdentityService.Models;
using IdentityService.Repositories;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace IdentityServiceTests.UnitMocking;

/// <summary>
/// SE3112 – Unit Testing &amp; Mocking.
/// AuthService is isolated from MySQL (mocked IUserRepository), BCrypt (mocked IPasswordHasher)
/// and JWT signing (mocked IJwtTokenGenerator). Configuration is a real in-memory stub.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class AuthServiceParameterizedMockTests
{
    private const string StaffCode = "BISTRO2026";

    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IJwtTokenGenerator> _jwt = new(MockBehavior.Strict);
    private readonly AuthService _sut;

    public AuthServiceParameterizedMockTests()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Staff:AuthorizationCode"] = StaffCode })
            .Build();
        _sut = new AuthService(_users.Object, _hasher.Object, _jwt.Object, configuration, NullLogger<AuthService>.Instance);

        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns<string>(p => $"hashed::{p}");
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _users.Setup(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>())).ReturnsAsync(10);
        _users.Setup(r => r.GetByIdAsync(10)).ReturnsAsync(new User { UserId = 10, FullName = "x", Email = "x@y.z", Roles = ["Customer"] });
    }

    private static RegisterRequestDto Registration(string? role = null, string? code = null, string email = "guest@bistro.lk") => new()
    {
        FullName = "  Nimal Perera  ",
        Email = email,
        PhoneNumber = " 0771234567 ",
        Password = "Secret#123",
        Role = role,
        StaffAuthorizationCode = code
    };

    [Theory]
    [InlineData(null, "Customer")]
    [InlineData("", "Customer")]
    [InlineData("   ", "Customer")]
    [InlineData("Customer", "Customer")]
    [InlineData("  Customer  ", "Customer")]
    public async Task Register_CustomerRoles_NeedNoStaffCode(string? requestedRole, string expectedRole)
    {
        await _sut.RegisterAsync(Registration(requestedRole));

        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), expectedRole), Times.Once);
    }

    [Theory]
    [InlineData("Admin", "BISTRO2026")]
    [InlineData("KitchenStaff", "BISTRO2026")]
    [InlineData("admin", "bistro2026")]          // role and code comparisons are case-insensitive
    [InlineData("KITCHENSTAFF", "  BISTRO2026  ")] // code is trimmed
    public async Task Register_StaffRoles_WithCorrectCode_AreCreated(string role, string code)
    {
        await _sut.RegisterAsync(Registration(role, code));

        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), role.Trim()), Times.Once);
    }

    [Theory]
    [InlineData("Admin", null)]
    [InlineData("Admin", "")]
    [InlineData("Admin", "WRONG")]
    [InlineData("KitchenStaff", "BISTRO2025")]
    [InlineData("kitchenstaff", " ")]
    public async Task Register_StaffRoles_WithoutValidCode_AreRejectedBeforeAnyDatabaseWork(string role, string? code)
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RegisterAsync(Registration(role, code)));

        Assert.Contains("staff authorization code", ex.Message, StringComparison.OrdinalIgnoreCase);
        _users.Verify(r => r.GetByEmailAsync(It.IsAny<string>()), Times.Never);
        _hasher.Verify(h => h.HashPassword(It.IsAny<string>()), Times.Never);
        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData("Guest@Bistro.LK", "guest@bistro.lk")]
    [InlineData("  OWNER@BISTRO.LK ", "owner@bistro.lk")]
    [InlineData("chef@bistro.lk", "chef@bistro.lk")]
    public async Task Register_PersistsNormalisedUserAndOnlyTheHashedPassword(string email, string storedEmail)
    {
        User? persisted = null;
        _users.Setup(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()))
            .Callback<User, string>((user, _) => persisted = user) // spy: capture what would hit MySQL
            .ReturnsAsync(10);

        await _sut.RegisterAsync(Registration(email: email));

        Assert.NotNull(persisted);
        Assert.Equal(storedEmail, persisted!.Email);
        Assert.Equal("Nimal Perera", persisted.FullName);
        Assert.Equal("0771234567", persisted.PhoneNumber);
        Assert.Equal("hashed::Secret#123", persisted.PasswordHash);
        Assert.NotEqual("Secret#123", persisted.PasswordHash); // plain text never reaches the repository
        Assert.True(persisted.IsActive);
        _hasher.Verify(h => h.HashPassword("Secret#123"), Times.Once);
    }

    [Fact]
    public async Task Register_DuplicateEmail_NeverHashesOrInserts()
    {
        _users.Setup(r => r.GetByEmailAsync("taken@bistro.lk")).ReturnsAsync(new User { UserId = 3, Email = "taken@bistro.lk" });

        await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RegisterAsync(Registration(email: "taken@bistro.lk")));

        _hasher.Verify(h => h.HashPassword(It.IsAny<string>()), Times.Never);
        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }

    public enum LoginFailure { UnknownEmail, InactiveAccount, WrongPassword }

    [Theory]
    [InlineData(LoginFailure.UnknownEmail)]
    [InlineData(LoginFailure.InactiveAccount)]
    [InlineData(LoginFailure.WrongPassword)]
    public async Task Login_AnyFailure_ThrowsSameGenericErrorAndIssuesNoToken(LoginFailure failure)
    {
        var user = new User { UserId = 5, Email = "guest@bistro.lk", PasswordHash = "stored-hash", IsActive = failure != LoginFailure.InactiveAccount, Roles = ["Customer"] };
        _users.Setup(r => r.GetByEmailAsync("guest@bistro.lk")).ReturnsAsync(failure == LoginFailure.UnknownEmail ? null : user);
        _hasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), "stored-hash")).Returns(false);

        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _sut.LoginAsync(new LoginRequestDto { Email = " guest@bistro.lk ", Password = "nope" }));

        // Identical message for every case => no account-enumeration oracle.
        Assert.Equal("Invalid email or password.", ex.Message);
        _jwt.VerifyNoOtherCalls(); // strict mock: a token must never be generated
        if (failure != LoginFailure.WrongPassword)
            _hasher.Verify(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Theory]
    [InlineData("Customer")]
    [InlineData("Admin")]
    [InlineData("Admin,KitchenStaff")]
    public async Task Login_ValidCredentials_ReturnsTokenForEveryRoleTheUserHolds(string roleList)
    {
        var roles = roleList.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var expires = new DateTime(2030, 1, 1, 13, 0, 0, DateTimeKind.Utc);
        var user = new User { UserId = 5, FullName = "Kasun", Email = "kasun@bistro.lk", PasswordHash = "stored-hash", IsActive = true, Roles = roles.ToList() };
        _users.Setup(r => r.GetByEmailAsync("kasun@bistro.lk")).ReturnsAsync(user);
        _hasher.Setup(h => h.VerifyPassword("correct", "stored-hash")).Returns(true);
        _jwt.Setup(j => j.GenerateToken(user, It.Is<IList<string>>(r => r.SequenceEqual(roles)))).Returns(("signed.jwt.token", expires));

        var response = await _sut.LoginAsync(new LoginRequestDto { Email = "kasun@bistro.lk", Password = "correct" });

        Assert.Equal("signed.jwt.token", response.Token);
        Assert.Equal(expires, response.ExpiresAt);
        Assert.Equal(roles, response.Roles);
        _jwt.Verify(j => j.GenerateToken(user, It.IsAny<IList<string>>()), Times.Once);
    }
}
