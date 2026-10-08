using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IdentityService.Models;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace IdentityServiceTests.UnitMocking;

/// <summary>SE3112 – Unit Testing &amp; Mocking: JWT contract shared by Identity and Reservation services.</summary>
[Trait("Category", "Unit")]
[Trait("Suite", "UnitMocking")]
public sealed class JwtTokenGeneratorParameterizedTests
{
    private const string Key = "Unit_Test_Signing_Key_That_Is_Long_Enough_For_HS256!";

    private static JwtTokenGenerator Generator(string? expiryMinutes = "60") => new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Key"] = Key,
            ["Jwt:Issuer"] = "SmartRestaurant",
            ["Jwt:Audience"] = "SmartRestaurantUsers",
            ["Jwt:ExpiryMinutes"] = expiryMinutes
        }).Build());

    private static readonly User Kasun = new() { UserId = 17, FullName = "Kasun Jay", Email = "kasun@bistro.lk" };

    [Theory]
    [InlineData("Customer")]
    [InlineData("Admin")]
    [InlineData("KitchenStaff")]
    [InlineData("Admin,KitchenStaff")]
    [InlineData("")]
    public void GenerateToken_EmbedsExactlyTheUsersRolesAndIdentity(string roleList)
    {
        var roles = roleList.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var (token, _) = Generator().GenerateToken(Kasun, roles);

        var principal = Validate(token);
        Assert.Equal(roles.Order(), principal.FindAll(ClaimTypes.Role).Select(c => c.Value).Order());
        Assert.Equal("17", principal.FindFirstValue(ClaimTypes.NameIdentifier));   // Reservation service reads this
        Assert.Equal("kasun@bistro.lk", principal.FindFirstValue(ClaimTypes.Email));
    }

    [Theory]
    [InlineData("15", 15)]
    [InlineData("60", 60)]
    [InlineData("1440", 1440)]
    [InlineData("not-a-number", 60)] // falls back to the safe default
    [InlineData(null, 60)]
    public void GenerateToken_ExpiryFollowsConfigurationWithSafeDefault(string? configured, int expectedMinutes)
    {
        var before = DateTime.UtcNow;

        var (token, expiresAt) = Generator(configured).GenerateToken(Kasun, [AppRoles.Customer]);

        Assert.InRange(expiresAt, before.AddMinutes(expectedMinutes).AddSeconds(-5), DateTime.UtcNow.AddMinutes(expectedMinutes).AddSeconds(5));
        Assert.Equal(expiresAt, new JwtSecurityTokenHandler().ReadJwtToken(token).ValidTo, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void GenerateToken_EveryTokenHasAUniqueJti()
    {
        var generator = Generator();
        var ids = Enumerable.Range(0, 50)
            .Select(_ => new JwtSecurityTokenHandler().ReadJwtToken(generator.GenerateToken(Kasun, [AppRoles.Customer]).Token).Id)
            .ToList();

        Assert.Equal(ids.Count, ids.Distinct().Count());
    }

    [Theory]
    [InlineData("Wrong_Signing_Key_That_Is_Also_Long_Enough_For_HS256!", "SmartRestaurant", "SmartRestaurantUsers")]
    [InlineData(Key, "EvilIssuer", "SmartRestaurantUsers")]
    [InlineData(Key, "SmartRestaurant", "SomeOtherApi")]
    public void GenerateToken_IsRejectedByAValidatorWithDifferentTrustSettings(string key, string issuer, string audience)
    {
        var (token, _) = Generator().GenerateToken(Kasun, [AppRoles.Admin]);

        Assert.ThrowsAny<SecurityTokenException>(() => Validate(token, key, issuer, audience));
    }

    private static ClaimsPrincipal Validate(string token, string key = Key, string issuer = "SmartRestaurant", string audience = "SmartRestaurantUsers") =>
        new JwtSecurityTokenHandler { MapInboundClaims = true }.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ValidIssuer = issuer,
            ValidAudience = audience,
            ClockSkew = TimeSpan.Zero
        }, out _);
}
