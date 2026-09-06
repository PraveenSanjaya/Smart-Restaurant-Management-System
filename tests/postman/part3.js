const { req } = require('./helper');

// ---------------------------------------------------------------
// FOLDER US-05: Table Creation
// ---------------------------------------------------------------
const folder05 = {
  name: "US-05 - Table Creation",
  item: [
    {
      name: "Happy Path",
      item: [
        req(
          "5.1 - Admin Creates Table (POST /api/tables)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-01",
            capacity: 4,
            location: "Main Hall",
            status: "Available"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Response contains table fields", function () {
    const json = pm.response.json();
    pm.expect(json.id).to.be.a("number");
    pm.expect(json.tableNumber).to.eql("T-QA-01");
    pm.expect(json.capacity).to.eql(4);
    pm.expect(json.location).to.eql("Main Hall");
    pm.expect(json.status).to.eql("Available");
    pm.expect(json.createdAt).to.be.a("string");
    pm.environment.set("createdTableId", json.id);
    pm.environment.set("createdTableNumber", json.tableNumber);
});
          `
        ),
        req(
          "5.2 - Admin Creates Table with Status Inactive",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-02",
            capacity: 2,
            location: "Patio",
            status: "Inactive"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Table created with Inactive status", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("Inactive");
    pm.environment.set("inactiveTableId", json.id);
});
          `
        ),
        req(
          "5.3 - Admin Creates Table with Status Occupied",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-OCCUPIED",
            capacity: 6,
            location: "Bar",
            status: "Occupied"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Table created with Occupied status", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("Occupied");
    pm.environment.set("occupiedTableId", json.id);
});
          `
        ),
        req(
          "5.4 - Admin Creates Table without Optional Status (defaults to Available)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-03",
            capacity: 8,
            location: "Terrace"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Default status is Available when omitted", function () {
    const json = pm.response.json();
    pm.expect(json.status).to.eql("Available");
    pm.environment.set("table03Id", json.id);
});
          `
        ),
        req(
          "5.5 - Admin Creates Table at Boundary Capacity=1 (min)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-MIN",
            capacity: 1,
            location: "Corner"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Min capacity 1 accepted", function () {
    const json = pm.response.json();
    pm.expect(json.capacity).to.eql(1);
    pm.environment.set("minTableId", json.id);
});
          `
        ),
        req(
          "5.6 - Admin Creates Table at Boundary Capacity=100 (max)",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-MAX",
            capacity: 100,
            location: "Banquet Hall"
          },
          null,
          `
pm.test("Status code is 201 Created", function () {
    pm.response.to.have.status(201);
});
pm.test("Max capacity 100 accepted", function () {
    const json = pm.response.json();
    pm.expect(json.capacity).to.eql(100);
    pm.environment.set("maxTableId", json.id);
});
          `
        )
      ]
    },
    {
      name: "Duplicate & Conflict",
      item: [
        req(
          "5.7 - Duplicate TableNumber -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-01",
            capacity: 4,
            location: "Duplicate Location"
          },
          null,
          `
pm.test("Status code is 400 Bad Request", function () {
    pm.response.to.have.status(400);
});
pm.test("Error references duplicate table number", function () {
    const text = pm.response.text();
    pm.expect(text.toLowerCase()).to.satisfy(t =>
        t.includes("duplicate") || t.includes("already exists") || t.includes("t-qa-01")
    );
});
          `
        )
      ]
    },
    {
      name: "Validation - Missing Fields",
      item: [
        req(
          "5.8 - Missing tableNumber -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.9 - Missing capacity -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-NO-CAP", location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.10 - Missing location -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-NO-LOC", capacity: 4 },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.11 - Empty Body -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {},
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        )
      ]
    },
    {
      name: "Validation - Invalid Values",
      item: [
        req(
          "5.12 - Capacity=0 (below min) -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-CAP-ZERO", capacity: 0, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.13 - Capacity=-1 (negative) -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-CAP-NEG", capacity: -1, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.14 - Capacity=101 (above max) -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-CAP-MAX", capacity: 101, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.15 - Invalid Status Value -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-BAD-STATUS", capacity: 4, location: "Main", status: "Broken" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.16 - tableNumber Empty String -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.17 - location Empty String -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-EMPTY-LOC", capacity: 4, location: "" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.18 - tableNumber Null -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: null, capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.19 - Capacity as String -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-STR-CAP", capacity: "four", location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.20 - Malformed JSON -> 400",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          `{"tableNumber": "T-BROKEN", "capacity":`,
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "5.21 - Wrong Content-Type (text/plain) -> 415",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "text/plain" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          `tableNumber=T01&capacity=4`,
          null,
          `pm.test("Status code is 415 Unsupported Media Type", function () { pm.response.to.have.status(415); });`
        )
      ]
    },
    {
      name: "Authorization",
      item: [
        req(
          "5.22 - No Token -> 401",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [{ key: "Content-Type", value: "application/json" }],
          { tableNumber: "T-NOAUTH", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "5.23 - Customer Token -> 403 Forbidden",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { tableNumber: "T-CUST-DENY", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "5.24 - KitchenStaff Token -> 403 Forbidden",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }
          ],
          { tableNumber: "T-KS-DENY", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "5.25 - Invalid Token -> 401",
          "POST",
          "{{reservationBaseUrl}}/tables",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer this.is.not.a.valid.jwt.token" }
          ],
          { tableNumber: "T-INVALID-TOKEN", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    }
  ]
};

// ---------------------------------------------------------------
// FOLDER US-06: Table Management (GET / PUT / DELETE)
// ---------------------------------------------------------------
const folder06 = {
  name: "US-06 - Table Management",
  item: [
    {
      name: "GET /api/tables/availability (Public)",
      item: [
        req(
          "6.1 - Get Available Tables Anonymously",
          "GET",
          "{{reservationBaseUrl}}/tables/availability",
          [],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response has 'available' boolean field", function () {
    const json = pm.response.json();
    pm.expect(json).to.be.an("object");
    pm.expect(json.available).to.be.a("boolean");
});
pm.test("Response has 'message' string field", function () {
    const json = pm.response.json();
    pm.expect(json.message).to.be.a("string");
    pm.expect(json.message.length).to.be.above(0);
});
          `
        )
      ]
    },
    {
      name: "GET /api/tables (Authenticated)",
      item: [
        req(
          "6.2 - Admin Gets All Tables",
          "GET",
          "{{reservationBaseUrl}}/tables",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Returns array of tables", function () {
    const json = pm.response.json();
    pm.expect(json).to.be.an("array");
    pm.expect(json.length).to.be.above(0);
});
          `
        ),
        req(
          "6.3 - Customer Gets All Tables (any authenticated user allowed)",
          "GET",
          "{{reservationBaseUrl}}/tables",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Customer can view tables list", function () {
    const json = pm.response.json();
    pm.expect(json).to.be.an("array");
});
          `
        ),
        req(
          "6.4 - KitchenStaff Gets All Tables",
          "GET",
          "{{reservationBaseUrl}}/tables",
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
          "6.5 - GET All Tables without Token -> 401",
          "GET",
          "{{reservationBaseUrl}}/tables",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "6.6 - GET All Tables with Invalid Token -> 401",
          "GET",
          "{{reservationBaseUrl}}/tables",
          [{ key: "Authorization", value: "Bearer completelyinvalidtokenstring" }],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    },
    {
      name: "GET /api/tables/{id}",
      item: [
        req(
          "6.7 - Get Table by Valid ID",
          "GET",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Response matches created table", function () {
    const json = pm.response.json();
    pm.expect(json.id).to.eql(parseInt(pm.environment.get("createdTableId")));
    pm.expect(json.tableNumber).to.eql(pm.environment.get("createdTableNumber"));
    pm.expect(json).to.have.all.keys("id","tableNumber","capacity","location","status","createdAt");
});
          `
        ),
        req(
          "6.8 - Get Table by Non-Existent ID -> 404",
          "GET",
          "{{reservationBaseUrl}}/tables/999999",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `pm.test("Status code is 404 Not Found", function () { pm.response.to.have.status(404); });`
        ),
        req(
          "6.9 - Get Table by ID=0 -> 404 or 400",
          "GET",
          "{{reservationBaseUrl}}/tables/0",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 400 or 404", function () {
    pm.expect([400, 404]).to.include(pm.response.code);
});
          `
        ),
        req(
          "6.10 - Get Table by Negative ID -> 404 or 400",
          "GET",
          "{{reservationBaseUrl}}/tables/-5",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 400 or 404", function () {
    pm.expect([400, 404]).to.include(pm.response.code);
});
          `
        ),
        req(
          "6.11 - Get Table without Token -> 401",
          "GET",
          "{{reservationBaseUrl}}/tables/1",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    },
    {
      name: "PUT /api/tables/{id} (Admin Only)",
      item: [
        req(
          "6.12 - Admin Updates Table Successfully",
          "PUT",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          {
            tableNumber: "T-QA-01-UPDATED",
            capacity: 6,
            location: "Updated Hall",
            status: "Available"
          },
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Updated fields reflected in response", function () {
    const json = pm.response.json();
    pm.expect(json.tableNumber).to.eql("T-QA-01-UPDATED");
    pm.expect(json.capacity).to.eql(6);
    pm.expect(json.location).to.eql("Updated Hall");
});
          `
        ),
        req(
          "6.13 - Verify Update via GET",
          "GET",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `
pm.test("Status code is 200 OK", function () {
    pm.response.to.have.status(200);
});
pm.test("Update persisted in database", function () {
    const json = pm.response.json();
    pm.expect(json.tableNumber).to.eql("T-QA-01-UPDATED");
    pm.expect(json.capacity).to.eql(6);
});
          `
        ),
        req(
          "6.14 - Update Non-Existent Table -> 404",
          "PUT",
          "{{reservationBaseUrl}}/tables/999999",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-GHOST", capacity: 4, location: "Nowhere" },
          null,
          `pm.test("Status code is 404 Not Found", function () { pm.response.to.have.status(404); });`
        ),
        req(
          "6.15 - Update Occupied Table Without Setting Available -> 400",
          "PUT",
          "{{reservationBaseUrl}}/tables/{{occupiedTableId}}",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-QA-OCCUPIED", capacity: 6, location: "Bar", status: "Inactive" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "6.16 - Update Table with Invalid Status -> 400",
          "PUT",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-QA-01-UPDATED", capacity: 4, location: "Main", status: "Dirty" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "6.17 - Update Table with Capacity=0 -> 400",
          "PUT",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{adminToken}}" }
          ],
          { tableNumber: "T-QA-01-UPDATED", capacity: 0, location: "Main" },
          null,
          `pm.test("Status code is 400 Bad Request", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "6.18 - Customer PUT Table -> 403 Forbidden",
          "PUT",
          "{{reservationBaseUrl}}/tables/1",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{customerToken}}" }
          ],
          { tableNumber: "T-01", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "6.19 - KitchenStaff PUT Table -> 403 Forbidden",
          "PUT",
          "{{reservationBaseUrl}}/tables/1",
          [
            { key: "Content-Type", value: "application/json" },
            { key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }
          ],
          { tableNumber: "T-01", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "6.20 - No Token PUT Table -> 401",
          "PUT",
          "{{reservationBaseUrl}}/tables/1",
          [{ key: "Content-Type", value: "application/json" }],
          { tableNumber: "T-01", capacity: 4, location: "Main" },
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        )
      ]
    },
    {
      name: "DELETE /api/tables/{id} (Admin Only, Hard Delete)",
      item: [
        req(
          "6.21 - Admin Deletes Available Table -> 204",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{minTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 204 No Content", function () {
    pm.response.to.have.status(204);
});
pm.test("Response body is empty", function () {
    pm.expect(pm.response.text()).to.eql("");
});
          `
        ),
        req(
          "6.22 - Verify Hard Delete (GET Deleted Table -> 404)",
          "GET",
          "{{reservationBaseUrl}}/tables/{{minTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 404 Not Found (hard delete confirmed)", function () {
    pm.response.to.have.status(404);
});
          `
        ),
        req(
          "6.23 - Admin Deletes Occupied Table -> 400",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{occupiedTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `pm.test("Status code is 400 Bad Request (cannot delete Occupied table)", function () { pm.response.to.have.status(400); });`
        ),
        req(
          "6.24 - Admin Deletes Non-Existent Table -> 404",
          "DELETE",
          "{{reservationBaseUrl}}/tables/999999",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `pm.test("Status code is 404 Not Found", function () { pm.response.to.have.status(404); });`
        ),
        req(
          "6.25 - Customer Deletes Table -> 403 Forbidden",
          "DELETE",
          "{{reservationBaseUrl}}/tables/1",
          [{ key: "Authorization", value: "Bearer {{customerToken}}" }],
          null,
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "6.26 - KitchenStaff Deletes Table -> 403 Forbidden",
          "DELETE",
          "{{reservationBaseUrl}}/tables/1",
          [{ key: "Authorization", value: "Bearer {{kitchenStaffToken}}" }],
          null,
          null,
          `pm.test("Status code is 403 Forbidden", function () { pm.response.to.have.status(403); });`
        ),
        req(
          "6.27 - No Token Delete Table -> 401",
          "DELETE",
          "{{reservationBaseUrl}}/tables/1",
          [],
          null,
          null,
          `pm.test("Status code is 401 Unauthorized", function () { pm.response.to.have.status(401); });`
        ),
        req(
          "6.28 - Admin Deletes Inactive Table -> 204",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{inactiveTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `
pm.test("Status code is 204 No Content", function () {
    pm.response.to.have.status(204);
});
          `
        ),
        req(
          "6.29 - Admin Cleans Up T-QA-02 (table03Id)",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{table03Id}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `pm.test("Status code is 204 No Content", function () { pm.response.to.have.status(204); });`
        ),
        req(
          "6.30 - Admin Cleans Up maxTableId",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{maxTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `pm.test("Status code is 204 No Content", function () { pm.response.to.have.status(204); });`
        ),
        req(
          "6.31 - Admin Cleans Up createdTableId (T-QA-01-UPDATED)",
          "DELETE",
          "{{reservationBaseUrl}}/tables/{{createdTableId}}",
          [{ key: "Authorization", value: "Bearer {{adminToken}}" }],
          null,
          null,
          `pm.test("Status code is 204 No Content", function () { pm.response.to.have.status(204); });`
        )
      ]
    }
  ]
};

console.log("Folders 05 and 06 defined");

module.exports = { folder05, folder06 };
