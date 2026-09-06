using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using SmartRestaurant.SeleniumTests.Configuration;
using SmartRestaurant.SeleniumTests.Utilities;

namespace SmartRestaurant.SeleniumTests;

/// <summary>
/// Browser-only Sprint 1 QA runner.  This intentionally has no unit-test framework:
/// every result is produced by a real Selenium Chrome session.
/// </summary>
public static class Program
{
    private const string Password = "Password123!";
    private static readonly string ResultsDirectory = Path.Combine(AppContext.BaseDirectory, "TestResults", "Screenshots");

    public static int Main()
    {
        Directory.CreateDirectory(ResultsDirectory);
        var cases = new (string Id, string Story, Action<IWebDriver> Execute)[]
        {
            ("TC-SEL-01", "US-1 Registration: required fields", RegistrationRequiredFields),
            ("TC-SEL-02", "US-1 Registration: invalid email", RegistrationInvalidEmail),
            ("TC-SEL-03", "US-1 Registration: short password", RegistrationShortPassword),
            ("TC-SEL-04", "US-1 Registration: valid registration", RegistrationValid),
            ("TC-SEL-05", "US-1 Registration: duplicate email", RegistrationDuplicateEmail),
            ("TC-SEL-06", "US-2 Authentication: invalid password", LoginInvalidPassword),
            ("TC-SEL-07", "US-2 Authentication: unregistered email", LoginUnknownEmail),
            ("TC-SEL-08", "US-2 Authentication: valid login and logout", LoginAndLogout),
            ("TC-SEL-09", "US-2 Authentication: protected page after logout", ProtectedRouteAfterLogout),
            ("TC-SEL-10", "US-3 RBAC: unauthenticated portal route", UnauthenticatedPortal),
            ("TC-SEL-11", "US-3 RBAC: customer blocked from admin", CustomerBlockedFromAdmin),
            ("TC-SEL-12", "US-4 Profile: unauthenticated profile route", UnauthenticatedProfile),
        };

        var passed = 0;
        var failed = 0;
        Console.WriteLine($"Selenium browser QA | Frontend: {TestSettings.BaseUrl}");
        foreach (var test in cases)
        {
            using var driver = WebDriverFactory.CreateChromeDriver();
            try
            {
                test.Execute(driver);
                passed++;
                Console.WriteLine($"PASS {test.Id} | {test.Story}");
            }
            catch (Exception exception)
            {
                failed++;
                var screenshot = SaveFailureEvidence(driver, test.Id);
                Console.WriteLine($"FAIL {test.Id} | {test.Story}\n  URL: {driver.Url}\n  Error: {exception.Message}\n  Screenshot: {screenshot}");
            }
        }

        Console.WriteLine($"SUMMARY Total: {cases.Length}; Passed: {passed}; Failed: {failed}; Blocked: 0; Skipped: 0");
        return failed == 0 ? 0 : 1;
    }

    private static void RegistrationRequiredFields(IWebDriver driver)
    {
        Go(driver, "/register");
        Submit(driver);
        Require(BodyContains(driver, "Full Name is required") && BodyContains(driver, "Email address is required") && BodyContains(driver, "Password is required"), "Required-field messages were not displayed.");
    }

    private static void RegistrationInvalidEmail(IWebDriver driver)
    {
        Go(driver, "/register");
        Fill(driver, "fullName", "QA Invalid Email");
        Fill(driver, "email", "not-an-email");
        Fill(driver, "password", Password);
        Fill(driver, "confirmPassword", Password);
        Submit(driver);
        Require(BodyContains(driver, "Please enter a valid email address"), "Invalid-email validation was not displayed.");
    }

    private static void RegistrationShortPassword(IWebDriver driver)
    {
        Go(driver, "/register");
        Fill(driver, "fullName", "QA Short Password");
        Fill(driver, "email", TestDataHelper.GenerateUniqueEmail("short-password"));
        Fill(driver, "password", "123");
        Fill(driver, "confirmPassword", "123");
        Submit(driver);
        Require(BodyContains(driver, "Password must be at least 6 characters"), "Short-password validation was not displayed.");
    }

    private static void RegistrationValid(IWebDriver driver)
    {
        var email = RegisterCustomer(driver, "registration-pass");
        WaitUntil(driver, d => BodyContains(d, "Registration Successful") || d.Url.Contains("/portal"), "Registration did not show success or navigate to the portal.");
        Require(!BodyContains(driver, Password), $"The registration UI exposed the submitted password for {email}.");
    }

    private static void RegistrationDuplicateEmail(IWebDriver driver)
    {
        var email = RegisterCustomer(driver, "duplicate-email");
        WaitUntil(driver, d => BodyContains(d, "Registration Successful") || d.Url.Contains("/portal"), "Initial registration did not complete.");
        Go(driver, "/register");
        Fill(driver, "fullName", "QA Duplicate");
        Fill(driver, "email", email);
        Fill(driver, "phoneNumber", "0771234567");
        Fill(driver, "password", Password);
        Fill(driver, "confirmPassword", Password);
        Submit(driver);
        WaitUntil(driver, d => d.FindElements(By.CssSelector(".alert-danger")).Any(), "Duplicate-email error was not displayed.");
        Require(!BodyContains(driver, Password), "Duplicate-email response exposed the password.");
    }

    private static void LoginInvalidPassword(IWebDriver driver)
    {
        Go(driver, "/login");
        Fill(driver, "loginEmail", "unknown.selenium@example.com");
        Fill(driver, "loginPassword", "WrongPassword999!");
        Submit(driver);
        WaitUntil(driver, d => d.FindElements(By.CssSelector(".alert-danger")).Any(), "Invalid-login error was not displayed.");
        Require(!BodyContains(driver, "WrongPassword999!"), "Invalid-login UI exposed the supplied password.");
    }

    private static void LoginUnknownEmail(IWebDriver driver)
    {
        Go(driver, "/login");
        Fill(driver, "loginEmail", TestDataHelper.GenerateUniqueEmail("unknown-login"));
        Fill(driver, "loginPassword", Password);
        Submit(driver);
        WaitUntil(driver, d => d.FindElements(By.CssSelector(".alert-danger")).Any(), "Unknown-email error was not displayed.");
    }

    private static void LoginAndLogout(IWebDriver driver)
    {
        var email = RegisterCustomer(driver, "login-logout");
        WaitUntil(driver, d => BodyContains(d, "Registration Successful") || d.Url.Contains("/portal"), "Registration did not complete.");
        Go(driver, "/login");
        Fill(driver, "loginEmail", email);
        Fill(driver, "loginPassword", Password);
        Submit(driver);
        WaitUntil(driver, d => d.Url.Contains("/portal"), "Valid customer login did not navigate to the portal.");
        ClickButton(driver, "Sign Out");
        ClickButton(driver, "Yes, Sign Out");
        WaitUntil(driver, d => d.Url.Contains("/login"), "Logout did not return the user to login.");
    }

    private static void ProtectedRouteAfterLogout(IWebDriver driver)
    {
        Go(driver, "/portal");
        WaitUntil(driver, d => d.Url.Contains("/login"), "Logged-out user reached a protected portal route.");
    }

    private static void UnauthenticatedPortal(IWebDriver driver)
    {
        Go(driver, "/portal");
        WaitUntil(driver, d => d.Url.Contains("/login"), "Unauthenticated user was not redirected from /portal.");
    }

    private static void CustomerBlockedFromAdmin(IWebDriver driver)
    {
        var email = RegisterCustomer(driver, "customer-rbac");
        WaitUntil(driver, d => BodyContains(d, "Registration Successful") || d.Url.Contains("/portal"), "Customer registration did not complete.");
        Go(driver, "/login");
        Fill(driver, "loginEmail", email);
        Fill(driver, "loginPassword", Password);
        Submit(driver);
        WaitUntil(driver, d => d.Url.Contains("/portal"), "Customer login did not complete.");
        Go(driver, "/admin");
        WaitUntil(driver, d => d.Url.Contains("/unauthorized"), "Customer was not blocked from /admin.");
    }

    private static void UnauthenticatedProfile(IWebDriver driver)
    {
        Go(driver, "/profile");
        WaitUntil(driver, d => d.Url.Contains("/login"), "Unauthenticated user was not redirected from /profile.");
    }

    private static string RegisterCustomer(IWebDriver driver, string prefix)
    {
        var email = TestDataHelper.GenerateUniqueEmail(prefix);
        Go(driver, "/register");
        Fill(driver, "fullName", "Selenium QA User");
        Fill(driver, "email", email);
        Fill(driver, "phoneNumber", "0771234567");
        Fill(driver, "password", Password);
        Fill(driver, "confirmPassword", Password);
        Submit(driver);
        return email;
    }

    private static void Go(IWebDriver driver, string route)
    {
        driver.Navigate().GoToUrl($"{TestSettings.BaseUrl}{route}");
        WaitUntil(driver, d => ((IJavaScriptExecutor)d).ExecuteScript("return document.readyState")?.ToString() == "complete", $"Page {route} did not finish loading.");
    }

    private static void Fill(IWebDriver driver, string id, string value)
    {
        var input = WaitUntil(driver, d => d.FindElements(By.Id(id)).FirstOrDefault(e => e.Displayed && e.Enabled), $"Input #{id} was not available.");
        input.Clear();
        input.SendKeys(value);
    }

    private static void Submit(IWebDriver driver) => WaitUntil(driver, d => d.FindElements(By.CssSelector("button[type='submit']")).FirstOrDefault(e => e.Displayed && e.Enabled), "Submit button was not available.").Click();

    private static void ClickButton(IWebDriver driver, string caption) => WaitUntil(driver, d => d.FindElements(By.TagName("button")).FirstOrDefault(e => e.Displayed && e.Enabled && e.Text.Trim() == caption), $"Button '{caption}' was not available.").Click();

    private static bool BodyContains(IWebDriver driver, string text) => driver.FindElement(By.TagName("body")).Text.Contains(text, StringComparison.OrdinalIgnoreCase);

    private static T WaitUntil<T>(IWebDriver driver, Func<IWebDriver, T?> condition, string failure) where T : class
    {
        try { return new WebDriverWait(driver, TimeSpan.FromSeconds(TestSettings.DefaultWaitSeconds)).Until(condition) ?? throw new WebDriverTimeoutException(failure); }
        catch (WebDriverTimeoutException) { throw new WebDriverTimeoutException(failure); }
    }

    private static void WaitUntil(IWebDriver driver, Func<IWebDriver, bool> condition, string failure)
    {
        try { new WebDriverWait(driver, TimeSpan.FromSeconds(TestSettings.DefaultWaitSeconds)).Until(condition); }
        catch (WebDriverTimeoutException) { throw new WebDriverTimeoutException(failure); }
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private static string SaveFailureEvidence(IWebDriver driver, string testId)
    {
        var path = Path.Combine(ResultsDirectory, $"{testId}_{DateTime.UtcNow:yyyyMMdd_HHmmss}_Fail.png");
        try { ((ITakesScreenshot)driver).GetScreenshot().SaveAsFile(path); return path; }
        catch { return "screenshot unavailable"; }
    }
}
