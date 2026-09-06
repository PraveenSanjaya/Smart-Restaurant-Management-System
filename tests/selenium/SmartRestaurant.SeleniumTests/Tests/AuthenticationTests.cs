using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;
using SmartRestaurant.SeleniumTests.Pages;
using SmartRestaurant.SeleniumTests.Utilities;
using Xunit;

namespace SmartRestaurant.SeleniumTests.Tests;

public class AuthenticationTests : IDisposable
{
    private readonly IWebDriver _driver;
    private readonly LoginPage _loginPage;
    private readonly RegisterPage _registerPage;
    private readonly CustomerPortalPage _portalPage;

    public AuthenticationTests()
    {
        _driver = WebDriverFactory.CreateChromeDriver();
        _loginPage = new LoginPage(_driver);
        _registerPage = new RegisterPage(_driver);
        _portalPage = new CustomerPortalPage(_driver);
    }

    public void Dispose()
    {
        _driver.Quit();
    }

    [Fact(DisplayName = "TC-SEL-01: Valid Customer Registration")]
    public void Test_01_ValidCustomerRegistration()
    {
        _registerPage.Navigate();
        var email = TestDataHelper.GenerateUniqueEmail("reg.pass");
        _registerPage.RegisterCustomer("Jane Doe", email, "0771234567", "Password123!", "Password123!");

        // Wait for redirect to /portal or success alert
        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        bool redirected = wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);
        Assert.True(redirected, "Expected registration to succeed and either display success or redirect to /portal.");
    }

    [Fact(DisplayName = "TC-SEL-02: Registration with Invalid Email")]
    public void Test_02_RegistrationInvalidEmail()
    {
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("Invalid User", "not-an-email", "0771234567", "Password123!", "Password123!");

        // Assert no navigation away from register
        Assert.Contains("/register", _driver.Url);
    }

    [Fact(DisplayName = "TC-SEL-03: Registration with Missing Required Fields")]
    public void Test_03_RegistrationMissingFields()
    {
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("", "", "", "", "");

        Assert.Contains("/register", _driver.Url);
    }

    [Fact(DisplayName = "TC-SEL-04: Registration with Short Password")]
    public void Test_04_RegistrationShortPassword()
    {
        _registerPage.Navigate();
        var email = TestDataHelper.GenerateUniqueEmail("short.pwd");
        _registerPage.RegisterCustomer("Jane Doe", email, "0771234567", "123", "123");

        Assert.Contains("/register", _driver.Url);
    }

    [Fact(DisplayName = "TC-SEL-05: Registration with Duplicate Email")]
    public void Test_05_RegistrationDuplicateEmail()
    {
        // First register
        var email = TestDataHelper.GenerateUniqueEmail("dup.test");
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("User One", email, "0771234567", "Password123!", "Password123!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(8));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // Attempt duplicate
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("User Two", email, "0771234567", "Password123!", "Password123!");

        var errorEl = wait.Until(d => d.FindElement(_registerPage.ErrorAlert));
        Assert.True(errorEl.Displayed);
        Assert.Contains("already exists", errorEl.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact(DisplayName = "TC-SEL-06: Valid Login Flow")]
    public void Test_06_ValidLogin()
    {
        // Register a user first to guarantee clean test credentials
        var email = TestDataHelper.GenerateUniqueEmail("login.valid");
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("Valid Login User", email, "0771234567", "Password123!", "Password123!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(8));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // Clear local storage and perform Login
        _loginPage.Navigate();
        _loginPage.Login(email, "Password123!");

        bool reachedPortal = wait.Until(d => d.Url.Contains("/portal"));
        Assert.True(reachedPortal, "User should be redirected to /portal after successful login.");
    }

    [Fact(DisplayName = "TC-SEL-07: Invalid Password Login")]
    public void Test_07_InvalidPasswordLogin()
    {
        _loginPage.Navigate();
        _loginPage.Login("qa@test.com", "WrongPassword999!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(8));
        var errorEl = wait.Until(d => d.FindElement(_loginPage.ErrorAlert));
        Assert.True(errorEl.Displayed);
        Assert.Contains("Invalid email or password", errorEl.Text);
    }

    [Fact(DisplayName = "TC-SEL-08: Invalid Email Login")]
    public void Test_08_InvalidEmailLogin()
    {
        _loginPage.Navigate();
        _loginPage.Login("nonexistent_user_999@bistro.com", "Password123!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(8));
        var errorEl = wait.Until(d => d.FindElement(_loginPage.ErrorAlert));
        Assert.True(errorEl.Displayed);
    }

    [Fact(DisplayName = "TC-SEL-09: Empty Credentials Login Validation")]
    public void Test_09_EmptyCredentialsLogin()
    {
        _loginPage.Navigate();
        _driver.FindElement(_loginPage.SubmitButton).Click();

        Assert.Contains("/login", _driver.Url);
    }
}
