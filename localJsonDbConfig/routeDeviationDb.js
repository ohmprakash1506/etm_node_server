const { JsonDB, Config } = require('node-json-db');
const routeDeviationDb = new JsonDB(new Config("routeDeviationDb", true, false, '/'));
module.exports = routeDeviationDb;