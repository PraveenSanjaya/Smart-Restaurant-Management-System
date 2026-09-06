using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using SmartRestaurant.SeleniumTests.Configuration;

namespace SmartRestaurant.SeleniumTests.Pages;

public class RegisterPage : BasePage
{
    public RegisterPage(IWebDriver driver) : base(driver) { }

    public By FullNameInput = By.Id("fullName");
    public By EmailInput = By.Id("email");
    public By PhoneInput = By.Id("phoneNumber");
    public By PasswordInput = By.Id("password");
    public By ConfirmPasswordInput = By.Id("confirmPassword");
    public By SubmitButton = By.CssSelector("button[type='submit']");
    public By ErrorAlert = By.CssSelector(".alert.alert-danger");
    public By SuccessAlert = By.CssSelector(".alert.alert-success");

    public By StaffTab = By.XPath("//button[contains(text(), 'Staff & Management')]");
    public By RoleSelect = By.Id("role");
    public By StaffAuthCodeInput = By.Id("staffAuthorizationCode");

    public void Navigate()
    {
        Driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/register");
        WaitForElementVisible(FullNameInput);
    }

    public void RegisterCustomer(string fullName, string email, string phone, string password, string confirmPassword)
    {
        var nameEl = WaitForElementVisible(FullNameInput);
        nameEl.Clear();
        nameEl.SendKeys(fullName);

        var emailEl = WaitForElementVisible(EmailInput);
        emailEl.Clear();
        emailEl.SendKeys(email);

        if (!string.IsNullOrEmpty(phone))
        {
            var phoneEl = WaitForElementVisible(PhoneInput);
            phoneEl.Clear();
            phoneEl.SendKeys(phone);
        }

        var passEl = WaitForElementVisible(PasswordInput);
        passEl.Clear();
        passEl.SendKeys(password);

        var confEl = WaitForElementVisible(ConfirmPasswordInput);
        confEl.Clear();
        confEl.SendKeys(confirmPassword);

        Driver.FindElement(SubmitButton).Click();
    }

    public void RegisterStaff(string fullName, string email, string phone, string password, string confirmPassword, string role, string staffCode)
    {
        // Switch to Staff tab
        WaitForElementVisible(StaffTab).Click();

        var nameEl = WaitForElementVisible(FullNameInput);
        nameEl.Clear();
        nameEl.SendKeys(fullName);

        var emailEl = WaitForElementVisible(EmailInput);
        emailEl.Clear();
        emailEl.SendKeys(email);

        if (!string.IsNullOrEmpty(phone))
        {
            var phoneEl = WaitForElementVisible(PhoneInput);
            phoneEl.Clear();
            phoneEl.SendKeys(phone);
        }

        var passEl = WaitForElementVisible(PasswordInput);
        passEl.Clear();
        passEl.SendKeys(password);

        var confEl = WaitForElementVisible(ConfirmPasswordInput);
        confEl.Clear();
        confEl.SendKeys(confirmPassword);

        var roleEl = WaitForElementVisible(RoleSelect);
        var selectElement = new SelectElement(roleEl);
        selectElement.SelectByValue(role);

        var codeEl = WaitForElementVisible(StaffAuthCodeInput);
        codeEl.Clear();
        codeEl.SendKeys(staffCode);

        Driver.FindElement(SubmitButton).Click();
    }
}
