const { JsonDB, Config } = require('node-json-db');
const deviceCorporateMappingDb = new JsonDB(new Config("deviceCorporateMappingDb", true, false, '/'));
module.exports = deviceCorporateMappingDb;