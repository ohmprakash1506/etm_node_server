const { JsonDB, Config } = require('node-json-db');
const GpsDeviceLiveDataJsonDb = new JsonDB(new Config("GpsDeviceLiveDataJsonDb", true, false, '/'));
module.exports = GpsDeviceLiveDataJsonDb;