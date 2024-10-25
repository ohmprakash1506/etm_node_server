const { JsonDB, Config } = require('node-json-db');
const lastTimeGoogleApiCalledDB = new JsonDB(new Config("lastTimeGoogleApiCalledDB", true, false, '/'));
module.exports = lastTimeGoogleApiCalledDB;