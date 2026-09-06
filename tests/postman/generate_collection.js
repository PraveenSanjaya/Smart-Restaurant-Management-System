const fs = require('fs');
const path = require('path');
const { folder00, folder01 } = require('./part1');
const { folder02, folder03, folder04 } = require('./part2');

const collection = {
  info: {
    name: 'Smart Restaurant API QA',
    _postman_id: '4c0a0f3a-1a13-4f73-9c9e-qa2026local',
    description: 'Executable API tests derived from the implemented Identity and Reservation service endpoints.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [folder00, folder01, folder02, folder03, folder04]
};

const outputPath = path.join(__dirname, 'SmartRestaurant_API_QA.postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log(`Generated ${outputPath}`);