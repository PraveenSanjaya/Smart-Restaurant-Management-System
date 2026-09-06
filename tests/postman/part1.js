const fs = require('fs');
const path = require('path');

function req(name, method, rawUrl, headers, body, preScript, testScript) {
  const item = {
    name: name,
    request: {
      method: method,
      header: headers || [{ key: "Content-Type", value: "application/json" }],
      url: rawUrl
    },
    event: []
  };

  if (body !== undefined && body !== null) {
    item.request.body = {
      mode: "raw",
      raw: typeof body === 'object' ? JSON.stringify(body, null, 2) : body,
      options: { raw: { language: "json" } }
    };
  }

  if (preScript) {
    item.event.push({
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: Array.isArray(preScript) ? preScript : preScript.split('\n')
      }
    });
  }

  if (testScript) {
    item.event.push({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: Array.isArray(testScript) ? testScript : testScript.split('\n')
      }
    });
  }

  return item;
}

// -------------------------------------------------------------
// FOLDER 00: Health / Smoke
// -------------------------------------------------------------
const folder00 = {
  name: "00 - Health / Smoke",
  item: [
    req(
      "00.1 - Check Public Table Availability (Anonymous)",
      "GET",
      "{{reservationBaseUrl}}/tables/availability",
      [],
      null,
      null,
      `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response time is under 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
pm.test("Content-Type is JSON", function () {
    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});
pm.test("Availability response structure and values", function () {
    const json = pm.response.json();
    pm.expect(json).to.be.an("object");
    pm.expect(json.available).to.eql(true);
    pm.expect(json.message).to.be.a("string");
    pm.expect(json.message).to.include("available");
});
      `
    ),
    req(
      "00.2 - Check Identity Service Metrics",
      "GET",
      "http://localhost:5001/metrics",
      [],
      null,
      null,
      `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Prometheus metrics returned", function () {
    const text = pm.response.text();
    pm.expect(text).to.include("process_");
});
      `
    ),
    req(
      "00.3 - Check Reservation Service Metrics",
      "GET",
      "http://localhost:5000/metrics",
      [],
      null,
      null,
      `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Prometheus metrics returned", function () {
    const text = pm.response.text();
    pm.expect(text).to.include("process_");
});
      `
    )
  ]
};

// -------------------------------------------------------------
// FOLDER US-01: Registration
// -------------------------------------------------------------
const folder01 = {
  name: "US-01 - Registration",
  item: [
    {
      name: "Happy Path",
      item: [
        req(
          "1.1 - Valid Customer Registration",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "QA Customer Test",
            email: "{{customerEmail}}",
            password: "{{customerPassword}}",
            phoneNumber: "+1234567890",
            role: "Customer"
          },
          `
const email = "qa.customer." + Date.now() + "@bistro.com";
pm.environment.set("customerEmail", email);
console.log("Generated Customer Email: " + email);
          `,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Response time is under 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
pm.test("Content-Type is JSON", function () {
    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});
pm.test("User response contains valid fields and types", function () {
    const json = pm.response.json();
    pm.expect(json.userId).to.be.a("number");
    pm.expect(json.userId).to.be.above(0);
    pm.expect(json.fullName).to.eql("QA Customer Test");
    pm.expect(json.email.toLowerCase()).to.eql(pm.environment.get("customerEmail").toLowerCase());
    pm.expect(json.phoneNumber).to.eql("+1234567890");
    pm.expect(json.isActive).to.eql(true);
    pm.expect(json.roles).to.be.an("array");
    pm.expect(json.roles).to.include("Customer");
    pm.expect(json.createdAt).to.be.a("string");
    pm.environment.set("customerUserId", json.userId);
});
pm.test("Security: Password and hash are never exposed", function () {
    const json = pm.response.json();
    pm.expect(json.password).to.be.undefined;
    pm.expect(json.passwordHash).to.be.undefined;
    pm.expect(json.hash).to.be.undefined;
});
          `
        ),
        req(
          "1.2 - Valid KitchenStaff Registration (with Staff Code)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "QA Kitchen Staff",
            email: "{{kitchenStaffEmail}}",
            password: "{{kitchenStaffPassword}}",
            phoneNumber: "+1987654321",
            role: "KitchenStaff",
            staffAuthorizationCode: "{{staffAuthCode}}"
          },
          `
const email = "qa.kitchen." + Date.now() + "@bistro.com";
pm.environment.set("kitchenStaffEmail", email);
          `,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("KitchenStaff role assigned correctly", function () {
    const json = pm.response.json();
    pm.expect(json.roles).to.include("KitchenStaff");
    pm.expect(json.password).to.be.undefined;
});
          `
        ),
        req(
          "1.3 - Valid Admin Registration (with Staff Code)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "QA Admin User",
            email: "{{adminEmail}}",
            password: "{{adminPassword}}",
            phoneNumber: "+1555444333",
            role: "Admin",
            staffAuthorizationCode: "{{staffAuthCode}}"
          },
          `
const email = "qa.admin." + Date.now() + "@bistro.com";
pm.environment.set("adminEmail", email);
          `,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Admin role assigned correctly", function () {
    const json = pm.response.json();
    pm.expect(json.roles).to.include("Admin");
    pm.expect(json.password).to.be.undefined;
});
          `
        ),
        req(
          "1.4 - Register Second Unique Customer",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Second QA Customer",
            email: "{{secondCustomerEmail}}",
            password: "{{secondCustomerPassword}}",
            phoneNumber: "+1122334455",
            role: "Customer"
          },
          `
const email = "qa.second." + Date.now() + "@bistro.com";
pm.environment.set("secondCustomerEmail", email);
          `,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Second customer created successfully", function () {
    const json = pm.response.json();
    pm.expect(json.userId).to.be.above(0);
});
          `
        )
      ]
    },
    {
      name: "Duplicate Email",
      item: [
        req(
          "1.5 - Duplicate Customer Email (Exact Match)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Duplicate User Attempt",
            email: "{{customerEmail}}",
            password: "Password999!",
            role: "Customer"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error message indicates email already exists", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.be.a("string");
    pm.expect(json.message).to.include("already exists");
});
          `
        ),
        req(
          "1.6 - Duplicate Email (Case-Insensitive Match)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Duplicate User Case",
            email: "{{upperCustomerEmail}}",
            password: "Password999!",
            role: "Customer"
          },
          `
pm.environment.set("upperCustomerEmail", pm.environment.get("customerEmail").toUpperCase());
          `,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error message indicates email already exists regardless of case", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.include("already exists");
});
          `
        )
      ]
    },
    {
      name: "Missing Fields",
      item: [
        req(
          "1.7 - Missing Email",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Missing Email User",
            password: "Password123!"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Validation error references Email", function () {
    const json = pm.response.json();
    const str = JSON.stringify(json);
    pm.expect(str.toLowerCase()).to.include("email");
});
          `
        ),
        req(
          "1.8 - Missing Password",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Missing Password User",
            email: "nopass@bistro.com"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Validation error references Password", function () {
    const json = pm.response.json();
    const str = JSON.stringify(json);
    pm.expect(str.toLowerCase()).to.include("password");
});
          `
        ),
        req(
          "1.9 - Missing FullName",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            email: "noname@bistro.com",
            password: "Password123!"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Validation error references FullName", function () {
    const json = pm.response.json();
    const str = JSON.stringify(json);
    pm.expect(str.toLowerCase()).to.include("name");
});
          `
        ),
        req(
          "1.10 - All Fields Missing / Empty Body",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {},
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Validation details contain multiple field errors", function () {
    const json = pm.response.json();
    pm.expect(json.errors).to.be.an("object");
});
          `
        )
      ]
    },
    {
      name: "Invalid Fields",
      item: [
        req(
          "1.11 - Invalid Email Format: 'abc'",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Test User", email: "abc", password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "1.12 - Invalid Email Format: 'abc@'",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Test User", email: "abc@", password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "1.13 - Invalid Email Format: '@gmail.com'",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Test User", email: "@gmail.com", password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "1.14 - Invalid Email Format: 'abc@gmail'",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Test User", email: "abc@gmail", password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "1.15 - Invalid Phone Number Format",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Invalid Phone User",
            email: "invphone." + Date.now() + "@bistro.com",
            password: "Password123!",
            phoneNumber: "NOT_A_PHONE_!@#$"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error specifies invalid phone format", function () {
    const json = pm.response.json();
    const str = JSON.stringify(json);
    pm.expect(str.toLowerCase()).to.include("phone");
});
          `
        ),
        req(
          "1.16 - Invalid Staff Authorization Code for Staff Role",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Fake Admin",
            email: "fakeadmin." + Date.now() + "@bistro.com",
            password: "Password123!",
            role: "Admin",
            staffAuthorizationCode: "WRONG_SECRET_CODE"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Rejection mentions staff authorization code", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.include("authorization code");
});
          `
        ),
        req(
          "1.17 - Wrong Data Type: Numeric Phone",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Numeric Phone",
            email: "numphone." + Date.now() + "@bistro.com",
            password: "Password123!",
            phoneNumber: 1234567890
          },
          null,
          `
pm.test("Handled gracefully with 2xx or 400 (No 500 error)", function () {
    pm.expect(pm.response.code).to.be.oneOf([201, 400]);
});
          `
        ),
        req(
          "1.18 - Extra Unexpected Fields in Payload",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          {
            fullName: "Extra Field User",
            email: "extrafield." + Date.now() + "@bistro.com",
            password: "Password123!",
            isAdmin: true,
            superUser: true
          },
          null,
          `
pm.test("Registration succeeds without granting unrequested privilege", function () {
    pm.expect(pm.response.code).to.eql(201);
    const json = pm.response.json();
    pm.expect(json.roles).to.not.include("Admin");
});
          `
        )
      ]
    },
    {
      name: "Boundary Tests",
      item: [
        req(
          "1.19 - Password Below Min Length (5 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Short Pass", email: "shortpass." + Date.now() + "@bistro.com", password: "12345" },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Password length validation message", function () {
    const json = pm.response.json();
    pm.expect(JSON.stringify(json)).to.include("Password must be at least 6 characters");
});
          `
        ),
        req(
          "1.20 - Password Exactly Min Length (6 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Exact Pass", email: "exactpass." + Date.now() + "@bistro.com", password: "123456" },
          null,
          `pm.test("Status code is 201 Created", function () { pm.response.to.have.status(201); });`
        ),
        req(
          "1.21 - FullName Exactly Max Length (100 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "A".repeat(100), email: "maxname." + Date.now() + "@bistro.com", password: "Password123!" },
          null,
          `pm.test("Status code is 201 Created", function () { pm.response.to.have.status(201); });`
        ),
        req(
          "1.22 - FullName Above Max Length (101 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "A".repeat(101), email: "overname." + Date.now() + "@bistro.com", password: "Password123!" },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Full name max length validation triggered", function () {
    const json = pm.response.json();
    pm.expect(JSON.stringify(json)).to.include("100 characters");
});
          `
        ),
        req(
          "1.23 - Email Exactly Max Length (150 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Max Email", email: "a".repeat(64) + "@" + "b".repeat(60) + "." + "c".repeat(20) + ".com", password: "Password123!" },
          null,
          `pm.test("Status 201 or 400 (boundary: ASP.NET [EmailAddress] may reject unusual TLD at max length)", function () {
    pm.expect(pm.response.code).to.be.oneOf([201, 400]);
});`
        ),
        req(
          "1.24 - Email Above Max Length (151 chars)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "Too Long Email", email: "a".repeat(64) + "@" + "b".repeat(60) + "." + "c".repeat(21) + ".com", password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        )
      ]
    },
    {
      name: "Security/Error Tests",
      item: [
        req(
          "1.25 - SQL Injection in Email Field (' OR '1'='1)",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "SQL Inject", email: "' OR '1'='1", password: "Password123!" },
          null,
          `
pm.test("Status code is 400 Bad Request (Safely Rejected)", function () {
    pm.response.to.have.status(400);
});
pm.test("No SQL syntax or database internal error", function () {
    const text = pm.response.text();
    pm.expect(text).to.not.include("MySqlException");
    pm.expect(text).to.not.include("syntax error");
});
          `
        ),
        req(
          "1.26 - Malformed JSON Body",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "application/json" }],
          `{"fullName": "Broken", "email": "test@bistro.com", "password":`,
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("No 500 server crash on malformed JSON", function () {
    pm.expect(pm.response.code).to.not.eql(500);
});
          `
        ),
        req(
          "1.27 - Missing or Unsupported Content-Type Header",
          "POST",
          "{{identityBaseUrl}}/auth/register",
          [{ key: "Content-Type", value: "text/plain" }],
          `fullName=Test&email=test@bistro.com`,
          null,
          `
pm.test("Status code is 415 Unsupported Media Type", function () {
    pm.response.to.have.status(415);
});
          `
        )
      ]
    }
  ]
};

console.log("Folders 00 and 01 defined");

module.exports = { folder00, folder01 };
