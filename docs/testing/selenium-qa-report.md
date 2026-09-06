# Selenium QA Execution Report

**Project:** Smart Restaurant Table Reservation & Order Management System  
**Execution date:** 6 September 2026  
**Execution method:** Selenium WebDriver browser UI tests

## Environment

| Item | Value |
| --- | --- |
| .NET SDK | 10.0.400 |
| Selenium packages | Selenium WebDriver / Support 4.28.0 |
| Browser driver | ChromeDriver 152.0.7977.82 |
| Frontend URL | `http://localhost:5173` |
| Identity service | `http://localhost:5001` |
| Reservation service | `http://localhost:5000` |

## Execution Summary

| Total | Passed | Failed | Blocked | Skipped |
| ---: | ---: | ---: | ---: | ---: |
| 12 | 12 | 0 | 0 | 0 |

All results below were obtained through real Chrome browser interactions. No API, Postman, Swagger, SQL, or direct database verification was used.

## Passed Test Cases

| ID | User story | Browser verification |
| --- | --- | --- |
| TC-SEL-01 | US-1 Registration | Required-field validation is displayed. |
| TC-SEL-02 | US-1 Registration | Invalid email is rejected by the UI. |
| TC-SEL-03 | US-1 Registration | Short password is rejected by the UI. |
| TC-SEL-04 | US-1 Registration | A valid customer can register successfully. |
| TC-SEL-05 | US-1 Registration | A duplicate email produces an error in the UI. |
| TC-SEL-06 | US-2 Authentication | Incorrect-password login shows a failure message. |
| TC-SEL-07 | US-2 Authentication | Unregistered-email login shows a failure message. |
| TC-SEL-08 | US-2 Authentication | Valid customer login reaches the portal and logout returns to login. |
| TC-SEL-09 | US-2 Authentication | A protected route is blocked after logout. |
| TC-SEL-10 | US-3 RBAC | An unauthenticated user is redirected from the customer portal. |
| TC-SEL-11 | US-3 RBAC | A customer is blocked from direct access to the admin route. |
| TC-SEL-12 | US-4 Profile | An unauthenticated user is redirected from the profile route. |

## Coverage Status by User Story

| User story | Status | Notes |
| --- | --- | --- |
| US-1 Registration & password handling | PASS | Registration, validation, duplicate email, and non-exposure checks executed through the UI. |
| US-2 Login & logout | PASS | Valid and invalid login flows, logout, and protected-route handling executed. |
| US-3 RBAC & navigation | PASS (partial) | Unauthenticated and Customer-to-Admin route protection executed. Admin and KitchenStaff navigation coverage is not yet in this suite. |
| US-4 Profile management | PASS (partial) | Unauthenticated profile-route protection executed. Profile editing, validation, and persistence are not yet in this suite. |
| US-5 Table creation & capacity setup | NOT TESTED | Admin table-creation UI scenarios are not yet implemented in the executed Selenium runner. |
| US-6 Table management & status updates | NOT TESTED | Edit, status update, and delete/deactivation UI scenarios are not yet implemented in the executed Selenium runner. |

## Observations

- Chrome emitted GPU-overlay and Google Cloud Messaging diagnostic messages during headless execution. They did not cause any Selenium test failure.
- No failure screenshots were generated because all executed tests passed.
- The complete execution output is retained at `tests/selenium/SmartRestaurant.SeleniumTests/TestResults/selenium-run.stdout.log`.

## Final Status

**READY WITH KNOWN COVERAGE GAPS**

The 12 implemented Selenium checks passed. Before declaring full Sprint 1 acceptance coverage, add and execute Selenium tests for Admin and KitchenStaff navigation, profile update/persistence, and the table creation/management workflows.
