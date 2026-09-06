using OpenQA.Selenium;
using SmartRestaurant.SeleniumTests.Configuration;

namespace SmartRestaurant.SeleniumTests.Pages;

public class CustomerPortalPage : BasePage
{
    public CustomerPortalPage(IWebDriver driver) : base(driver) { }

    public By WelcomeHeader = By.XPath("//h1[contains(text(), 'Welcome')]");
    public By PortalContainer = By.CssSelector(".portal-container");
    public By EditProfileButton = By.CssSelector("[data-testid='edit-profile-button']");
    public By ProfileFullName = By.CssSelector("[data-testid='profile-fullname']");
    public By ProfilePhone = By.CssSelector("[data-testid='profile-phone']");
    public By EditFullNameInput = By.CssSelector("[data-testid='edit-fullname-input']");
    public By EditPhoneInput = By.CssSelector("[data-testid='edit-phone-input']");
    public By SaveProfileButton = By.CssSelector("[data-testid='save-profile-button']");
    public By LogoutButton = By.CssSelector("[data-testid='logout-button']");
    public By EditSuccess = By.CssSelector("[data-testid='edit-success']");

    public void Navigate()
    {
        Driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}/portal");
    }

    public bool IsAt()
    {
        try
        {
            return WaitForElementVisible(WelcomeHeader).Displayed;
        }
        catch { return false; }
    }

    public string GetProfileFullName()
    {
        return WaitForElementVisible(ProfileFullName).Text.Trim();
    }

    public void UpdateProfile(string newName, string newPhone)
    {
        WaitForElementVisible(EditProfileButton).Click();
        var nameInput = WaitForElementVisible(EditFullNameInput);
        nameInput.Clear();
        nameInput.SendKeys(newName);

        var phoneInput = WaitForElementVisible(EditPhoneInput);
        phoneInput.Clear();
        phoneInput.SendKeys(newPhone);

        WaitForElementVisible(SaveProfileButton).Click();
        WaitForElementVisible(EditSuccess);
    }

    public void Logout()
    {
        WaitForElementVisible(LogoutButton).Click();
    }
}
