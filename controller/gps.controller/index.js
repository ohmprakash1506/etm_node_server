const BSON = require('bson');
const client = require('../../mongodb');
// const dbName = "etravelmat"; //DEV
// const dbName = 'travelmat'; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;
const validator = require('../../validator');
const { JsonDB, Config } = require('node-json-db');
const jsonDB = new JsonDB(new Config("jsonDb", true, false, '/'));

const database = client.db(dbName);

const { io } = require("../../app");

function dateInMillisecond(val) {
  const date = new Date(val);
  console.log('date :>> ', date);
  const milliseconds = date.getTime();
  return milliseconds;
}


exports.getLiveData = async (req, res) => {
  try {
    var allVch = await jsonDB.getData("/"+req.body.date+"/"+req.body.corpId);
    res.status(200).json(allVch);
  } catch(error) {
      // The error will tell you where the DataPath stopped. In this case test1
      // Since /test1/test does't exist.
    console.error(error);
    res.status(200).json({message: error.name});
  };
  
 
}

exports.deleteLiveData = async (req, res) => {
  await jsonDB.delete("/"+req.body.date);
  res.status(200).json({message: "Record deleted."});
}

