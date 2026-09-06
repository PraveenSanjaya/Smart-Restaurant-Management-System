using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace SmartRestaurant.SeleniumTests.Pages;

public abstract class BasePage
{
    protected readonly IWebDriver Driver;
    protected readonly WebDriverWait Wait;

    protected BasePage(IWebDriver driver)
    {
        Driver = driver;
        Wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
    }

    protected IWebElement WaitForElementVisible(By by)
    {
        return Wait.Until(d =>
        {
            try
            {
                var el = d.FindElement(by);
                return el.Displayed ? el : null;
            }
            catch (NoSuchElementException) { return null; }
            catch (StaleElementReferenceException) { return null; }
        })!;
    }
}
