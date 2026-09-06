namespace SmartRestaurant.SeleniumTests.Utilities;

public static class TestDataHelper
{
    public static string GenerateUniqueEmail(string prefix = "selenium.qa")
    {
        return $"{prefix}.{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}@bistro.com";
    }
}
