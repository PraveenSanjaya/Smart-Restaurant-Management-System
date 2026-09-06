using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;
using SmartRestaurant.SeleniumTests.Pages;
using SmartRestaurant.SeleniumTests.Utilities;
using Xunit;

namespace SmartRestaurant.SeleniumTests.Tests;

public class IncompleteSprintFeaturesTests : IDisposable
{
    private readonly IWebDriver _driver;
    private readonly LoginPage _loginPage;
    private readonly RegisterPage _registerPage;
    private readonly CustomerPortalPage _customerPortalPage;
    private readonly AdminDashboardPage _adminDashboardPage;

    public IncompleteSprintFeaturesTests()
    {
        _driver = WebDriverFactory.CreateChromeDriver();
        _loginPage = new LoginPage(_driver);
        _registerPage = new RegisterPage(_driver);
        _customerPortalPage = new CustomerPortalPage(_driver);
        _adminDashboardPage = new AdminDashboardPage(_driver);
    }

    public void Dispose()
    {
        _driver.Quit();
    }

    [Fact(DisplayName = "TC-SEL-12: US-4 Customer Profile Update UI and Persistence")]
    public void Test_12_CustomerProfileUpdateUI()
    {
        // 1. Register a new customer
        var email = TestDataHelper.GenerateUniqueEmail("profile.cust");
        _registerPage.Navigate();
        _registerPage.RegisterCustomer("Original Name", email, "0771112233", "Password123!", "Password123!");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // 2. Authenticate customer via Login
        _loginPage.Navigate();
        _loginPage.Login(email, "Password123!");
        wait.Until(d => d.Url.Contains("/portal"));

        // 3. Verify profile loaded
        Assert.True(_customerPortalPage.IsAt(), "Customer should be on the portal page.");
        var currentName = _customerPortalPage.GetProfileFullName();
        Assert.Equal("Original Name", currentName);

        // 4. Update profile
        var updatedName = "Updated Customer Name";
        _customerPortalPage.UpdateProfile(updatedName, "0778889900");

        // 5. Refresh page and verify persistence from DB
        _driver.Navigate().Refresh();
        wait.Until(d => _customerPortalPage.IsAt());

        var persistedName = _customerPortalPage.GetProfileFullName();
        Assert.Equal(updatedName, persistedName);
    }

    [Fact(DisplayName = "TC-SEL-13: US-5 Admin Add Table Modal Form and Duplicate Prevention")]
    public void Test_13_AdminAddTableModalFormUI()
    {
        // 1. Register an admin
        var adminEmail = TestDataHelper.GenerateUniqueEmail("admin.table");
        _registerPage.Navigate();
        _registerPage.RegisterStaff("Admin Staff", adminEmail, "0775556677", "Password123!", "Password123!", "Admin", "BISTRO2026");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // 2. Authenticate admin via Login
        _loginPage.Navigate();
        _loginPage.Login(adminEmail, "Password123!");
        wait.Until(d => d.Url.Contains("/admin"));

        Assert.True(_adminDashboardPage.IsAt(), "Admin should be on the management dashboard.");

        // 3. Add a new table
        var tableNum = "SEL-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()[^4..];
        _adminDashboardPage.AddTable(tableNum, 4, "Window Side");

        // 4. Verify table appears in list
        wait.Until(d => _adminDashboardPage.IsTableInList(tableNum));
        Assert.True(_adminDashboardPage.IsTableInList(tableNum), $"Table {tableNum} should be visible in table list.");

        // 5. Attempt duplicate TableNumber creation -> expect error in UI
        _adminDashboardPage.AddTable(tableNum, 2, "Patio");
        var error = _adminDashboardPage.GetAddModalError();
        Assert.Contains("already exists", error);
        _adminDashboardPage.CloseAddModal();
    }

    [Fact(DisplayName = "TC-SEL-14: US-6 Admin Table Management, Edit Capacity & Soft Deactivation")]
    public void Test_14_AdminTableManagementUI()
    {
        // 1. Register an admin
        var adminEmail = TestDataHelper.GenerateUniqueEmail("admin.crud");
        _registerPage.Navigate();
        _registerPage.RegisterStaff("Admin CRUD", adminEmail, "0773334455", "Password123!", "Password123!", "Admin", "BISTRO2026");

        var wait = new OpenQA.Selenium.Support.UI.WebDriverWait(_driver, TimeSpan.FromSeconds(10));
        wait.Until(d => d.Url.Contains("/portal") || d.FindElements(_registerPage.SuccessAlert).Count > 0);

        // 2. Authenticate admin via Login
        _loginPage.Navigate();
        _loginPage.Login(adminEmail, "Password123!");
        wait.Until(d => d.Url.Contains("/admin"));

        // 3. Add table
        var tableNum = "MGT-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()[^4..];
        _adminDashboardPage.AddTable(tableNum, 2, "Main Dining");
        wait.Until(d => _adminDashboardPage.IsTableInList(tableNum));

        // 4. Edit table capacity & location
        _adminDashboardPage.EditTable(tableNum, 8, "VIP Section");
        _driver.Navigate().Refresh();
        wait.Until(d => _adminDashboardPage.IsAt());

        var updatedCapacity = _adminDashboardPage.GetTableCapacity(tableNum);
        Assert.Contains("8", updatedCapacity);

        // 5. Soft-deactivate table
        _adminDashboardPage.DeactivateTable(tableNum);
        _driver.Navigate().Refresh();
        wait.Until(d => _adminDashboardPage.IsAt());

        var status = _adminDashboardPage.GetTableActiveStatus(tableNum);
        Assert.Equal("Inactive", status);
    }
}
