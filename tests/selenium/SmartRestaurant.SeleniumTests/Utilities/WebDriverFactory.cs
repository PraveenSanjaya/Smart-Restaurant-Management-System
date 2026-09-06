using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using SmartRestaurant.SeleniumTests.Configuration;

namespace SmartRestaurant.SeleniumTests.Utilities;

public static class WebDriverFactory
{
    public static IWebDriver CreateChromeDriver()
    {
        var options = new ChromeOptions();
        if (TestSettings.Headless)
        {
            options.AddArgument("--headless=new");
        }
        options.AddArgument("--disable-gpu");
        options.AddArgument("--no-sandbox");
        options.AddArgument("--disable-dev-shm-usage");
        options.AddArgument("--window-size=1920,1080");
        options.AddArgument("--ignore-certificate-errors");

        var driver = new ChromeDriver(options);
        driver.Manage().Timeouts().ImplicitWait = TimeSpan.FromSeconds(2);
        return driver;
    }
}
