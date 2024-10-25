const BSON = require('bson');
const client = require('../../mongodb');
// const dbName = "etravelmat"; //DEV
// const dbName = 'travelmat'; //UAT
//const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;
const validator = require('../../validator');
const { JsonDB, Config } = require('node-json-db');
const jsonDB = new JsonDB(new Config("jsonDb", true, false, '/'));
const routeDeviationDb = require("../../localJsonDbConfig/routeDeviationDb")
const database = client.db(dbName);

function dateInMillisecond(val) {
  const date = new Date(val);
  console.log('date :>> ', date);
  const milliseconds = date.getTime();
  return milliseconds;
}

exports.addTripDirection = async (req, res) => {
    async function run() {
      try {
        const path = `/TripDirections/${req.body.tripId}`;
        const isRouteExists = await routeDeviationDb.exists(path);
        if(!isRouteExists){
         await routeDeviationDb.push(path, req.body);
        }
        const tripDirections = database.collection('TripDirections');
        const query = { tripId: req.body.tripId };
        const update = { $set: req.body};
        const options = { upsert: true };
        tripDirections.updateOne(query, update, options);
        
        return res.status(200).json({
          status: 200,
          message: "success",
        });
        

        // return res.status(404).json({
        //     status: 404,
        //     message: "No record found as per your data",
        //     data
        //   });
        //   console.log(data);
      } finally {
        //   await client.close();
      }
    }
    run().catch(console.dir);
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


exports.getTripDirectionById = async (req, res) => {
  async function run() {
      try {
      //   const database = client.db(dbName);
        const employees = database.collection('TripDirections');
        const query = { tripId: req.params.tripId };
        const data = await employees.find(query).toArray();
        res.json({data: data})
        // console.log(data);
      } finally {
        // Ensures that the client will close when you finish/error
      //   await client.close();
      }
    }
    run().catch(console.dir);
    
}
