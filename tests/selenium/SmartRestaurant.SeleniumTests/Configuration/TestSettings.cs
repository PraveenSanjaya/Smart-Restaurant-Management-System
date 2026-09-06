namespace SmartRestaurant.SeleniumTests.Configuration;

public static class TestSettings
{
    public static string BaseUrl => Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
    public static string IdentityApiUrl => Environment.GetEnvironmentVariable("IDENTITY_API_URL") ?? "http://localhost:5001/api";
    public static string ReservationApiUrl => Environment.GetEnvironmentVariable("RESERVATION_API_URL") ?? "http://localhost:5002/api";
    public static int DefaultWaitSeconds => 10;
    public static bool Headless => true;
}
