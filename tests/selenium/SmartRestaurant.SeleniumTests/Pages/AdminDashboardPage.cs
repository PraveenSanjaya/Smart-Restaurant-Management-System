using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;

namespace SmartRestaurant.SeleniumTests.Pages;

public class AdminDashboardPage : BasePage
{
    public AdminDashboardPage(IWebDriver driver) : base(driver) { }

    public By Header = By.XPath("//h1[contains(text(), 'Management Dashboard')]");
    public By AdminBox = By.CssSelector(".admin-container");
    public By LogoutButton = By.CssSelector("[data-testid='logout-button']");
    public By AddTableButton = By.CssSelector("[data-testid='add-table-button']");
    public By AddTableModal = By.CssSelector("[data-testid='add-table-modal']");
    public By AddTableNumberInput = By.CssSelector("[data-testid='add-table-number-input']");
    public By AddCapacityInput = By.CssSelector("[data-testid='add-capacity-input']");
    public By AddLocationInput = By.CssSelector("[data-testid='add-location-input']");
    public By SubmitAddTableButton = By.CssSelector("[data-testid='submit-add-table-button']");
    public By AddModalError = By.CssSelector("[data-testid='add-modal-error']");
    public By ActionSuccess = By.CssSelector("[data-testid='action-success']");

    // Edit modal
    public By EditCapacityInput = By.CssSelector("[data-testid='edit-capacity-input']");
    public By EditLocationInput = By.CssSelector("[data-testid='edit-location-input']");
    public By SubmitEditTableButton = By.CssSelector("[data-testid='submit-edit-table-button']");

    public void Navigate()
    {
        Driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/admin");
    }

    public bool IsAt()
    {
        try
        {
            return WaitForElementVisible(Header).Displayed;
        }
        catch { return false; }
    }

    public void AddTable(string tableNumber, int capacity, string location)
    {
        WaitForElementVisible(AddTableButton).Click();
        WaitForElementVisible(AddTableModal);

        var numInput = WaitForElementVisible(AddTableNumberInput);
        numInput.Clear();
        numInput.SendKeys(tableNumber);

        var capInput = WaitForElementVisible(AddCapacityInput);
        capInput.Clear();
        capInput.SendKeys(capacity.ToString());

        var locInput = WaitForElementVisible(AddLocationInput);
        locInput.Clear();
        locInput.SendKeys(location);

        WaitForElementVisible(SubmitAddTableButton).Click();
    }

    public bool IsTableInList(string tableNumber)
    {
        try
        {
            return WaitForElementVisible(By.CssSelector($"[data-testid='table-row-{tableNumber}']")).Displayed;
        }
        catch
        {
            return false;
        }
    }

    public string GetAddModalError()
    {
        return WaitForElementVisible(AddModalError).Text.Trim();
    }

    public void CloseAddModal()
    {
        WaitForElementVisible(By.CssSelector("[data-testid='cancel-add-table-button']")).Click();
    }

    public void EditTable(string tableNumber, int newCapacity, string newLocation)
    {
        WaitForElementVisible(By.CssSelector($"[data-testid='edit-table-btn-{tableNumber}']")).Click();
        var capInput = WaitForElementVisible(EditCapacityInput);
        capInput.Clear();
        capInput.SendKeys(newCapacity.ToString());

        var locInput = WaitForElementVisible(EditLocationInput);
        locInput.Clear();
        locInput.SendKeys(newLocation);

        WaitForElementVisible(SubmitEditTableButton).Click();
        WaitForElementVisible(ActionSuccess);
    }

    public string GetTableCapacity(string tableNumber)
    {
        return WaitForElementVisible(By.CssSelector($"[data-testid='col-capacity-{tableNumber}']")).Text.Trim();
    }

    public string GetTableActiveStatus(string tableNumber)
    {
        return WaitForElementVisible(By.CssSelector($"[data-testid='col-active-{tableNumber}']")).Text.Trim();
    }

    public void DeactivateTable(string tableNumber)
    {
        WaitForElementVisible(By.CssSelector($"[data-testid='deactivate-table-btn-{tableNumber}']")).Click();
        // Accept the JS window.confirm dialog
        var alert = Driver.SwitchTo().Alert();
        alert.Accept();
        WaitForElementVisible(ActionSuccess);
    }

    public void Logout()
    {
        WaitForElementVisible(LogoutButton).Click();
    }
}
