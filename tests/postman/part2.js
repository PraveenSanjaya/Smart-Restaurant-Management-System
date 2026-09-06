const { req } = require('./helper');

// -------------------------------------------------------------
// FOLDER US-02: Authentication
// -------------------------------------------------------------
const folder02 = {
  name: "US-02 - Authentication",
  item: [
    {
      name: "Valid Login",
      item: [
        req(
          "2.1 - Customer Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          {
            email: "{{customerEmail}}",
            password: "{{customerPassword}}"
          },
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response contains valid JWT token and user info", function () {
    const json = pm.response.json();
    pm.expect(json.token).to.be.a("string");
    pm.expect(json.token.length).to.be.above(20);
    pm.expect(json.userId).to.be.a("number");
    pm.expect(json.email.toLowerCase()).to.eql(pm.environment.get("customerEmail").toLowerCase());
    pm.expect(json.roles).to.include("Customer");
    pm.expect(json.expiresAt).to.be.a("string");
    pm.environment.set("customerToken", json.token);
    pm.environment.set("jwtToken", json.token);
});
          `
        ),
        req(
          "2.2 - KitchenStaff Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          {
            email: "{{kitchenStaffEmail}}",
            password: "{{kitchenStaffPassword}}"
          },
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("KitchenStaff JWT token issued", function () {
    const json = pm.response.json();
    pm.expect(json.token).to.be.a("string");
    pm.expect(json.roles).to.include("KitchenStaff");
    pm.environment.set("kitchenStaffToken", json.token);
});
          `
        ),
        req(
          "2.3 - Admin Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          {
            email: "{{adminEmail}}",
            password: "{{adminPassword}}"
          },
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Admin JWT token issued", function () {
    const json = pm.response.json();
    pm.expect(json.token).to.be.a("string");
    pm.expect(json.roles).to.include("Admin");
    pm.environment.set("adminToken", json.token);
});
          `
        )
      ]
    },
    {
      name: "Negative Login",
      item: [
        req(
          "2.4 - Correct Email + Wrong Password",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: "{{customerEmail}}", password: "WrongPassword999!" },
          null,
          `
pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Generic error message without sensitive info leakage", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.eql("Invalid email or password");
});
          `
        ),
        req(
          "2.5 - Unknown Email + Correct Password",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: "nonexistent.user." + Date.now() + "@bistro.com", password: "{{customerPassword}}" },
          null,
          `
pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Generic error message without revealing user does not exist", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.eql("Invalid email or password");
});
          `
        ),
        req(
          "2.6 - Unknown Email + Wrong Password",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: "nonexistent.user." + Date.now() + "@bistro.com", password: "WrongPassword999!" },
          null,
          `
pm.test("Status code is 401 Unauthorized", function () {
    pm.response.to.have.status(401);
});
pm.test("Generic error message is returned", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.eql("Invalid email or password");
});
          `
        ),
        req(
          "2.7 - Missing Email in Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { password: "Password123!" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "2.8 - Missing Password in Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: "{{customerEmail}}" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "2.9 - Empty Strings in Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: "", password: "" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "2.10 - Null Credentials in Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          { email: null, password: null },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "2.11 - Malformed JSON in Login",
          "POST",
          "{{identityBaseUrl}}/auth/login",
          [{ key: "Content-Type", value: "application/json" }],
          `{"email": "broken"`,
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        )
      ]
    },
    {
      name: "JWT Validation & Token Tests",
      item: [
        req(
          "2.12 - Inspect and Validate JWT Claims",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("JWT token decodes with expected claims", function () {
    const token = pm.environment.get("customerToken");
    pm.expect(token).to.be.a("string");
    const parts = token.split('.');
    pm.expect(parts.length).to.eql(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    pm.expect(payload).to.be.an("object");
    const emailClaim = payload.email || payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
    const roleClaim = payload.role || payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    const emailValue = Array.isArray(emailClaim) ? emailClaim.find(value => typeof value === "string") : emailClaim;
    const roleValues = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
    pm.expect(emailValue.toLowerCase()).to.eql(pm.environment.get("customerEmail").toLowerCase());
    pm.expect(roleValues).to.include("Customer");
    pm.expect(payload.sub).to.be.a("string");
    pm.expect(payload.iss).to.eql("SmartRestaurant");
    pm.expect(payload.aud).to.eql("SmartRestaurantUsers");
    pm.expect(payload.exp).to.be.above(Math.floor(Date.now() / 1000));
});
          `
        ),
        req(
          "2.13 - Missing Authorization Header",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "2.14 - Random String Token",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [{ key: "Authorization", value: "Bearer CompletelyInvalidRandomTokenString" }],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "2.15 - Tampered Token Signature",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [{ key: "Authorization", value: "Bearer {{tamperedToken}}" }],
          null,
          `
const token = pm.environment.get("customerToken");
if (token && token.length > 10) {
    pm.environment.set("tamperedToken", token.substring(0, token.length - 8) + "XXXXXXXX");
} else {
    pm.environment.set("tamperedToken", "fake.tampered.token");
}
          `,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "2.16 - Expired Token Rejection",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [{ key: "Authorization", value: "Bearer {{expiredToken}}" }],
          null,
          `
const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64');
const expiredPayload = Buffer.from(JSON.stringify({
    sub: "1",
    email: "expired@bistro.com",
    role: "Customer",
    iss: "SmartRestaurant",
    aud: "SmartRestaurantUsers",
    exp: 1000000000 // September 2001
})).toString('base64');
pm.environment.set("expiredToken", header + "." + expiredPayload + ".fakeSignature");
          `,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "2.17 - Wrong Authorization Scheme (Basic instead of Bearer)",
          "GET",
          "{{identityBaseUrl}}/auth/profile",
          [{ key: "Authorization", value: "Basic YWRtaW46cGFzc3dvcmQ=" }],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    }
  ]
};

// -------------------------------------------------------------
// FOLDER US-03: RBAC
// -------------------------------------------------------------
const folder03 = {
  name: "US-03 - RBAC",
  item: [
    {
      name: "Admin",
      item: [
        req(
          "3.1 - Admin Token -> Admin Endpoint (/api/auth/admin/users)",
          "GET",
          "{{identityBaseUrl}}/auth/admin/users",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Admin access granted message", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.include("Admin authorized");
});
          `
        ),
        req(
          "3.2 - Admin Token -> Staff Endpoint (/api/auth/staff/summary)",
          "GET",
          "{{identityBaseUrl}}/auth/staff/summary",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
          `
        )
      ]
    },
    {
      name: "Customer",
      item: [
        req(
          "3.3 - Customer Token -> Profile Endpoint (/api/users/profile)",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
          `
        ),
        req(
          "3.4 - Customer Token -> Admin Endpoint (/api/auth/admin/users)",
          "GET",
          "{{identityBaseUrl}}/auth/admin/users",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
          `
        ),
        req(
          "3.5 - Customer Token -> Staff Endpoint (/api/auth/staff/summary)",
          "GET",
          "{{identityBaseUrl}}/auth/staff/summary",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
          `
        ),
        req(
          "3.6 - Customer Token -> Table Creation (/api/tables)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { tableNumber: "T-FAIL-CUST", capacity: 4, location: "Main" },
          null,
          `
pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
          `
        )
      ]
    },
    {
      name: "KitchenStaff",
      item: [
        req(
          "3.7 - KitchenStaff Token -> Staff Endpoint (/api/auth/staff/summary)",
          "GET",
          "{{identityBaseUrl}}/auth/staff/summary",
          [{ key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
          `
        ),
        req(
          "3.8 - KitchenStaff Token -> Admin Endpoint (/api/auth/admin/users)",
          "GET",
          "{{identityBaseUrl}}/auth/admin/users",
          [{ key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }],
          null,
          null,
          `
pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
          `
        ),
        req(
          "3.9 - KitchenStaff Token -> Table Creation (/api/tables)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }
          ],
          { tableNumber: "T-FAIL-KITCHEN", capacity: 4, location: "Main" },
          null,
          `
pm.test("Status code is 403 Forbidden", function () {
    pm.response.to.have.status(403);
});
          `
        )
      ]
    },
    {
      name: "401 and 403 Matrix",
      item: [
        req(
          "3.10 - Unauthenticated Access on Admin Endpoint -> 401",
          "GET",
          "{{identityBaseUrl}}/auth/admin/users",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "3.11 - Unauthenticated Access on Staff Endpoint -> 401",
          "GET",
          "{{identityBaseUrl}}/auth/staff/summary",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "3.12 - Customer Token -> Table Update -> 403 Forbidden",
          "PUT",
          "{{reservationBaseUrl}}/tables/1",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { tableNumber: "T-01", capacity: 4, location: "Window" },
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "3.13 - Customer Token -> Table Delete -> 403 Forbidden",
          "DELETE",
          "{{reservationBaseUrl}}/tables/1",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        )
      ]
    }
  ]
};

// -------------------------------------------------------------
// FOLDER US-04: User Profile
// -------------------------------------------------------------
const folder04 = {
  name: "US-04 - Profile",
  item: [
    {
      name: "Get Profile",
      item: [
        req(
          "4.1 - Customer Get Profile (GET /api/users/profile)",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Profile structure matches UserResponseDto", function () {
    const json = pm.response.json();
    pm.expect(json.userId).to.be.a("number");
    pm.expect(json.email.toLowerCase()).to.eql(pm.environment.get("customerEmail").toLowerCase());
    pm.expect(json.fullName).to.be.a("string");
    pm.expect(json.isActive).to.eql(true);
    pm.expect(json.roles).to.be.an("array");
    pm.expect(json.password).to.be.undefined;
});
          `
        ),
        req(
          "4.2 - Admin Get Profile (GET /api/users/profile)",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Admin profile shows Admin role", function () {
    const json = pm.response.json();
    pm.expect(json.roles).to.include("Admin");
});
          `
        )
      ]
    },
    {
      name: "Update Profile",
      item: [
        req(
          "4.3 - Customer Update Profile Contact Details (PUT /api/users/profile)",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          {
            fullName: "Updated Customer Name",
            email: "{{customerEmail}}",
            phoneNumber: "+1999888777"
          },
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Updated values reflected in response", function () {
    const json = pm.response.json();
    pm.expect(json.fullName).to.eql("Updated Customer Name");
    pm.expect(json.phoneNumber).to.eql("+1999888777");
});
          `
        ),
        req(
          "4.4 - Verify Updated Profile via Subsequent GET",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Persistent database update verified", function () {
    const json = pm.response.json();
    pm.expect(json.fullName).to.eql("Updated Customer Name");
    pm.expect(json.phoneNumber).to.eql("+1999888777");
});
          `
        )
      ]
    },
    {
      name: "Validation",
      item: [
        req(
          "4.5 - Update Profile Missing FullName",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { email: "{{customerEmail}}", phoneNumber: "+1999888777" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "4.6 - Update Profile Missing Email",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { fullName: "Name Only", phoneNumber: "+1999888777" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "4.7 - Update Profile Invalid Email Format",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { fullName: "Test Name", email: "invalid-email-address", phoneNumber: "+1999888777" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "4.8 - Update Profile Invalid Phone Number",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { fullName: "Test Name", email: "{{customerEmail}}", phoneNumber: "invalid_phone_!@#" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "4.9 - Update Profile Email Conflict with Existing User",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { fullName: "Conflict User", email: "{{secondCustomerEmail}}", phoneNumber: "+1999888777" },
          null,
          `
pm.test("Status code is 409 Conflict", function () {
    pm.response.to.have.status(409);
});
pm.test("Error message describes email conflict", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.include("already in use");
});
          `
        )
      ]
    },
    {
      name: "Unauthorized & Token",
      item: [
        req(
          "4.10 - GET Profile without Token -> 401",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "4.11 - PUT Profile without Token -> 401",
          "PUT",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Content-Type", value: "application/json" }],
          { fullName: "No Token", email: "notoken@bistro.com" },
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "4.12 - GET Profile with Tampered Token -> 401",
          "GET",
          "{{identityBaseUrl}}/users/profile",
          [{ key: "Authorization", value: "Bearer {{tamperedToken}}" }],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    }
  ]
};

console.log("Folders 02, 03, 04 defined");

module.exports = { folder02, folder03, folder04 };
