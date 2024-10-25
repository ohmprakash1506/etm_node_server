const { JsonDB, Config } = require('node-json-db');
const startedTripsDb = new JsonDB(new Config("startedTripsDb", true, false, '/'));
module.exports = startedTripsDb;