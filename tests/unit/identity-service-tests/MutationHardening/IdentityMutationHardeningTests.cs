using System.IdentityModel.Tokens.Jwt;
using IdentityService.DTOs;
using IdentityService.Models;
using IdentityService.Repositories;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace IdentityServiceTests.MutationHardening;

/// <summary>
/// SE3112 – Mutation Testing.
/// Written to kill mutants that <b>survived</b> the first Stryker.NET run on the Identity service.
/// Root cause of most survivors: existing tests configured values identical to the hard-coded
/// fallbacks (e.g. staff code "BISTRO2026"), so "ignore configuration" mutants were indistinguishable.
/// </summary>
[Trait("Category", "Unit")]
[Trait("Suite", "MutationHardening")]
public sealed class IdentityMutationHardeningTests
{
    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value)).Build();

    private static AuthService Auth(IConfiguration configuration, Mock<IUserRepository>? users = null)
    {
        users ??= new Mock<IUserRepository>();
        users.Setup(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>())).ReturnsAsync(1);
        users.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(new User { UserId = 1, Email = "a@b.c", Roles = ["Admin"] });
        return new AuthService(users.Object, Mock.Of<IPasswordHasher>(), Mock.Of<IJwtTokenGenerator>(), configuration, NullLogger<AuthService>.Instance);
    }

    private static RegisterRequestDto Admin(string code) =>
        new() { FullName = "Admin", Email = "admin@bistro.lk", Password = "Secret#123", Role = "Admin", StaffAuthorizationCode = code };

    // Kills: AuthService L39 "Null coalescing (remove left)" – a deployment-specific code must replace the default.
    [Fact]
    public async Task ConfiguredStaffCode_ReplacesTheBuiltInDefault()
    {
        var auth = Auth(Config(("Staff:AuthorizationCode", "COLOMBO-HQ-77")));

        await auth.RegisterAsync(Admin("COLOMBO-HQ-77"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => auth.RegisterAsync(Admin("BISTRO2026")));
    }

    // Kills: AuthService L39 String mutation ("BISTRO2026" -> "") – the documented fallback must keep working.
    [Fact]
    public async Task MissingStaffCodeConfiguration_FallsBackToTheDocumentedDefault()
    {
        var auth = Auth(Config());

        var created = await auth.RegisterAsync(Admin("BISTRO2026"));

        Assert.Equal(1, created.UserId);
    }

    // Kills: JwtTokenGenerator L20–L22 null-coalescing and string mutations on issuer/audience/key.
    [Fact]
    public void ConfiguredIssuerAndAudience_AreWrittenIntoTheToken()
    {
        var generator = new JwtTokenGenerator(Config(
            ("Jwt:Key", "Another_Signing_Key_That_Is_Long_Enough_For_HS256!!"),
            ("Jwt:Issuer", "CinnamonBistro.Identity"),
            ("Jwt:Audience", "CinnamonBistro.Reservations")));

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(generator.GenerateToken(new User { UserId = 1, Email = "a@b.c" }, []).Token);

        Assert.Equal("CinnamonBistro.Identity", jwt.Issuer);
        Assert.Equal(["CinnamonBistro.Reservations"], jwt.Audiences);
    }

    [Fact]
    public void MissingJwtConfiguration_FallsBackToTheValuesTheReservationServiceTrusts()
    {
        var generator = new JwtTokenGenerator(Config());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(generator.GenerateToken(new User { UserId = 1, Email = "a@b.c" }, []).Token);

        Assert.Equal("SmartRestaurant", jwt.Issuer);
        Assert.Equal(["SmartRestaurantUsers"], jwt.Audiences);
        Assert.Equal("HS256", jwt.Header.Alg);
    }

    // Kills: UserService L35/L44 String mutations – controllers map these exceptions to HTTP responses.
    [Fact]
    public async Task UpdateProfile_ErrorMessagesAreStable()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(new User { UserId = 1, Email = "me@bistro.lk" });
        users.Setup(r => r.GetByEmailAsync("taken@bistro.lk")).ReturnsAsync(new User { UserId = 2, Email = "taken@bistro.lk" });
        var service = new UserService(users.Object, NullLogger<UserService>.Instance);

        var missing = await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateProfileAsync(404, new UpdateProfileRequestDto { FullName = "x", Email = "x@y.z" }));
        var taken = await Assert.ThrowsAsync<InvalidOperationException>(() => service.UpdateProfileAsync(1, new UpdateProfileRequestDto { FullName = "x", Email = "taken@bistro.lk" }));

        Assert.Equal("User not found", missing.Message);
        Assert.Equal("Email is already in use by another account", taken.Message);
    }

    // Covers UserService L56 (previously NoCoverage): the UPDATE matched no row (deleted concurrently).
    [Fact]
    public async Task UpdateProfile_RowVanishesDuringUpdate_ThrowsKeyNotFound()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(new User { UserId = 1, Email = "me@bistro.lk" });
        users.Setup(r => r.UpdateUserProfileAsync(1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>())).ReturnsAsync(false);
        var service = new UserService(users.Object, NullLogger<UserService>.Instance);

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateProfileAsync(1, new UpdateProfileRequestDto { FullName = "Me", Email = "me@bistro.lk" }));

        Assert.Equal("User not found or no changes were made", ex.Message);
    }

    // Covers UserService L62 (previously NoCoverage): the re-read after a successful UPDATE returns nothing.
    [Fact]
    public async Task UpdateProfile_UserDeletedBeforeReRead_ThrowsKeyNotFound()
    {
        var users = new Mock<IUserRepository>();
        users.SetupSequence(r => r.GetByIdAsync(1))
            .ReturnsAsync(new User { UserId = 1, Email = "me@bistro.lk" }) // initial read
            .ReturnsAsync((User?)null);                                      // read-back after UPDATE
        users.Setup(r => r.UpdateUserProfileAsync(1, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>())).ReturnsAsync(true);
        var service = new UserService(users.Object, NullLogger<UserService>.Instance);

        var ex = await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateProfileAsync(1, new UpdateProfileRequestDto { FullName = "Me", Email = "me@bistro.lk" }));

        Assert.Equal("User not found after update", ex.Message);
    }
}
