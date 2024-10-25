const { JsonDB, Config } = require('node-json-db');
const coveredRouteCordsDb = new JsonDB(new Config("coveredRouteCordsDb", true, false, '/'));
module.exports = coveredRouteCordsDb;