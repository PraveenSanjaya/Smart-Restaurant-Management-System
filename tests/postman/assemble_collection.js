const fs = require('fs');
const path = require('path');

const { folder00, folder01 } = require('./part1');
const { folder02, folder03, folder04 } = require('./part2');
const { folder05, folder06 } = require('./part3');

// ---------------------------------------------------------------
// Full Collection
// ---------------------------------------------------------------
const collection = {
  info: {
    name: "SmartRestaurant_API_QA",
    description: "Comprehensive API Test Suite for Smart Restaurant Table Reservation & Order Management System. Covers Happy Path, Negative, Boundary, Auth, RBAC, CRUD, Schema, Validation, and Error Handling tests.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [folder00, folder01, folder02, folder03, folder04, folder05, folder06]
};

// ---------------------------------------------------------------
// Smoke Collection (subset: folder00 only)
// ---------------------------------------------------------------
const smokeCollection = {
  info: {
    name: "SmartRestaurant_Smoke",
    description: "Smoke test subset: Health checks and critical authentication flow.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [folder00, {
    name: "Smoke - Auth & Tables",
    item: [
      // Customer register + login + get tables
      ...folder01.item[0].item.slice(0, 1), // register customer
      ...folder02.item[0].item,              // all valid logins
      folder06.item[1].item[0]               // GET all tables (admin)
    ]
  }]
};

const outDir = path.join(__dirname);

const fullPath = path.join(outDir, 'SmartRestaurant_API_QA.postman_collection.json');
const smokePath = path.join(outDir, 'SmartRestaurant_Smoke.postman_collection.json');

fs.writeFileSync(fullPath, JSON.stringify(collection, null, 2), 'utf8');
fs.writeFileSync(smokePath, JSON.stringify(smokeCollection, null, 2), 'utf8');

// Count tests
let totalTests = 0;
function countTests(items) {
  for (const item of items) {
    if (item.item) {
      countTests(item.item);
    } else {
      totalTests++;
      const testEvents = (item.event || []).filter(e => e.listen === 'test');
      if (testEvents.length > 0) {
        const script = testEvents[0].script.exec.join('\n');
        const matches = script.match(/pm\.test\(/g);
        if (matches) totalTests += matches.length - 1;
      }
    }
  }
}

countTests(collection.item);

console.log(`\n✅  Full collection written to:  ${fullPath}`);
console.log(`✅  Smoke collection written to: ${smokePath}`);
console.log(`📊  Approximate request/assertion count: ${totalTests}`);
