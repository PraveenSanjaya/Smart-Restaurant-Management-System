# Smart Restaurant API QA Report

## Execution

- Environment: local Docker Compose services
- Identity API: `http://localhost:5001`
- Reservation API: `http://localhost:5000`
- Database used by live containers: Docker MySQL on `localhost:3307`
- Runner: Newman
- Collection: `SmartRestaurant_API_QA.postman_collection.json`
- Requests executed: 72
- Assertions: 109
- Passed assertions: 108
- Failed assertions: 1
- Blocked requests: 0 in the implemented collection

## Coverage

The executed collection covers the implemented Identity and Reservation APIs:

- Registration, duplicate registration, required fields, invalid fields, boundary values, malformed JSON, content type, and SQL-injection-style input
- Login, generic authentication failures, JWT extraction, JWT expiry/tampering checks, and authorization header checks
- Admin, Customer, and KitchenStaff authorization checks with 401/403 distinctions
- Profile retrieval, profile update, validation, conflict handling, and persistence workflow
- Public table availability, table listing, table lookup, table creation, table update, deactivation, validation, duplicate table numbers, and authorization
- Response status, content type, response shape, sensitive-field exclusion, and response-time smoke assertions

## Failure

### DEF-001: Invalid email accepted during registration

- Endpoint: `POST /api/auth/register`
- Request email: `abc@gmail`
- Expected: `400 Bad Request`
- Actual: `201 Created`
- Severity: Medium
- Priority: Medium
- Evidence: Newman report and request `1.14 - Invalid Email Format: 'abc@gmail'`
- Suspected cause: the current ASP.NET `[EmailAddress]` validation accepts this value.

This is an observed application-validation failure, not a Postman configuration failure.

## Blocked / Not Implemented

- Billing/report API: `BLOCKED / NOT IMPLEMENTED` in the current branch; no backend project was found.
- Order API: `BLOCKED / NOT IMPLEMENTED` in the current branch; no backend project was found.
- A separate Postman test folder for billing/order workflows was not created because no real endpoints or DTOs exist to test.

## Final Status

`READY WITH KNOWN ISSUES` for the implemented Identity and Reservation services.

The full machine-readable Newman result is stored in `SmartRestaurant_API_QA.newman.json`.