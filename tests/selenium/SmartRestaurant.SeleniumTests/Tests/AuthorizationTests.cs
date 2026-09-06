using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;
using SmartRestaurant.SeleniumTests.Pages;
using SmartRestaurant.SeleniumTests.Utilities;
using Xunit;

namespace SmartRestaurant.SeleniumTests.Tests;

public class AuthorizationTests : IDisposable
{
    private readonly IWebDriver _driver;
    private readonly LoginPage _loginPage;
    private readonly RegisterPage _registerPage;
    private readonly UnauthorizedPage _unauthorizedPage;
    private readonly AdminDashboardPage _adminPage;

    public AuthorizationTests()
    {
        _driver = WebDriverFactory.CreateChromeDriver();
        _loginPage = new LoginPage(_driver);
        _registerPage = new RegisterPage(_driver);
        _unauthorizedPage = new UnauthorizedPage(_driver);
        _adminPage = new AdminDashboardPage(_driver);
    }

    public void Dispose()
    {
        _driver.Quit();
    }

    [Fact(DisplayName = "TC-SEL-10: Unauthenticated User Redirected to Login")]
    public void Test_10_UnauthenticatedDirectNavigationToProtectedPortal()
    {
        _driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/portal");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(8));
        bool redirected = wait.Until(d => d.Url.Contains("/login"));
        Assert.True(redirected, "Direct unauthenticated access to /portal must redirect to /login.");
    }

    [Fact(DisplayName = "TC-SEL-11: Customer Denied Direct Access to Admin Dashboard")]
    public void Test_11_CustomerDeniedAdminDashboard()
    {
        // Register customer
        var email = TestDataHelper.GenerateUniqueEmail("cust.rbac");
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("Customer RBAC", email, "0771234567", "Password123!", "Password123!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // Authenticate customer via Login
        _loginPage.Navigate();
        _loginPage.Login(email, "Password123!");
        wait.Until(d => d.Url.Contains("/portal"));

        // Now attempt direct navigation to /admin
        _driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/admin");

        bool blocked = wait.Until(d => d.Url.Contains("/unauthorized"));
        Assert.True(blocked, "Authenticated Customer user should be denied access to /admin and redirected to /unauthorized.");
    }
}
