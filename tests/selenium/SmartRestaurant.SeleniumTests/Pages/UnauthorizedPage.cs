using OpenQA.Selenium;

namespace SmartRestaurant.SeleniumTests.Pages;

public class UnauthorizedPage : BasePage
{
    public UnauthorizedPage(IWebDriver driver) : base(driver) { }

    public By AccessDeniedHeader = By.XPath("//h1[contains(text(), '403 - Access Denied')]");

    public bool IsAt()
    {
        try
        {
            return WaitForElementVisible(AccessDeniedHeader).Displayed;
        }
        catch { return false; }
    }
}
