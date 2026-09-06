using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;

namespace SmartRestaurant.SeleniumTests.Pages;

public class LoginPage : BasePage
{
    public LoginPage(IWebDriver driver) : base(driver) { }

    public By EmailInput = By.Id("loginEmail");
    public By PasswordInput = By.Id("loginPassword");
    public By SubmitButton = By.CssSelector("button[type='submit']");
    public By ErrorAlert = By.CssSelector(".alert.alert-danger");
    public By SuccessAlert = By.CssSelector(".alert.alert-success");
    public By EmailError = By.XPath("//input[@id='loginEmail']/ancestor::div[contains(@class,'form-group')]//div[contains(@class,'error-text')]");
    public By PasswordError = By.XPath("//input[@id='loginPassword']/ancestor::div[contains(@class,'form-group')]//div[contains(@class,'error-text')]");

    public void Navigate()
    {
        Driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/login");
        WaitForElementVisible(EmailInput);
    }

    public void Login(string email, string password)
    {
        var emailEl = WaitForElementVisible(EmailInput);
        emailEl.Clear();
        emailEl.SendKeys(email);

        var passEl = WaitForElementVisible(PasswordInput);
        passEl.Clear();
        passEl.SendKeys(password);

        Driver.FindElement(SubmitButton).Click();
    }

    public string GetErrorMessage()
    {
        return WaitForElementVisible(ErrorAlert).Text;
    }

    public bool IsErrorAlertDisplayed()
    {
        try { return Driver.FindElement(ErrorAlert).Displayed; }
        catch { return false; }
    }
}
