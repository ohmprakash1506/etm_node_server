require("dotenv").config();

const axios = require('axios')
const client = require("../mongodb");

//const dbName = "etravelmat"; //DEV
//  const dbName = "travelmat"; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE
const database = client.db(dbName);
const { JsonDB, Config } = require('node-json-db');
const deviceCorporateMappingDb = require('../localJsonDbConfig/deviceCorporateMappingDb.js')
const startedTripsJsonDB = require('../localJsonDbConfig/startedTripsDB.js')
const corporateSettingJsonDb = new JsonDB(new Config("corporateSettingJsonDb", true, false, '/'));
const fs = require('fs');

function isValidJson(jsonString) {
  try {
    JSON.parse(jsonString);
    return true;
  } catch (e) {
    return false;
  }
}
const startInterval = async (intervalRef) => {
  if (!intervalRef) {
    try {


    const url = "http://localhost:3000/api/gps-devices/trip-started?tripId=startTrip";
    const headers = {
      'Content-Type': 'application/json'
    };
    const res = await axios.get(`${url}`)
    console.log(res, "Nero Res+++++++++++++++++++++++++")
  } catch (error) {
      console.log(error, "axios error in catch")
  }
  }
}
const mapGpsToCorps = async () => {

  const url = process.env.APP_DOMAIN + "/user-reg/public/get-All-Vehicle-imei-data";
  let groupedByDeviceImei;
  try {
    const deviceCorpsData = await axios.get(`${url}`)

    if (deviceCorpsData.data.status == 200) {
      groupedByDeviceImei = deviceCorpsData.data.data.reduce((acc, curr) => {
        const deviceImei = curr.deviceImei;
        if (!acc[deviceImei]) {
          acc[deviceImei] = [];
        }
        acc[deviceImei].push(curr);
        return acc;
      }, {});
    }
  } catch (error) {
    console.log(error, "Error from api")
  }

  const dbFilePath = deviceCorporateMappingDb.config.filename;
  if (fs.existsSync(dbFilePath)) {
    const fileContent = fs.readFileSync(dbFilePath, 'utf8');

    // If the file is empty or contains invalid JSON, initialize it with an empty JSON object
    if (!fileContent || fileContent.trim() === '' || !isValidJson(fileContent)) {
      fs.writeFileSync(dbFilePath, '{}');
    }
  } else {
    console.log('file not found')
  }

  if (groupedByDeviceImei) {
    try {
      await deviceCorporateMappingDb.push("/", groupedByDeviceImei);
    } catch (error) {
      if (error.name === 'DatabaseError') {
        await deviceCorporateMappingDb.push("/", groupedByDeviceImei);
      } else {
        // Handle other errors
        console.error('An unexpected error occurred:', error);
      }

    }
  }
};

const populateCorpSetting = async () => {
  const dbFilePath = corporateSettingJsonDb.config.filename;
  if (fs.existsSync(dbFilePath)) {
    const fileContent = fs.readFileSync(dbFilePath, 'utf8');

    // If the file is empty or contains invalid JSON, initialize it with an empty JSON object
    if (!fileContent || fileContent.trim() === '' || !isValidJson(fileContent)) {
      fs.writeFileSync(dbFilePath, '{}');
    }
  } else {
    console.log('file not found')
  }

  const DriverSetting = database.collection("DriverSetting");
  const driverSettings = await DriverSetting.find().toArray();
  if (driverSettings.length > 0) {
    let cookJson = {};
    for (let i = 0; i < driverSettings.length; i++) {
      //console.log(driverSettings[i].corporateId[0])
      cookJson[driverSettings[i].corporateId[0]] = { ...driverSettings[i] }
    }
    try {
      await corporateSettingJsonDb.push("/", cookJson);
    } catch (error) {
      if (error.name === 'DatabaseError') {
        await corporateSettingJsonDb.push("/", cookJson);
      } else {
        // Handle other errors
        console.error('An unexpected error occurred:', error);
      }

    }

  }
};

const populateStartedTrips = async () => {

  const dbFilePath = startedTripsJsonDB.config.filename;
  if (fs.existsSync(dbFilePath)) {
    const fileContent = fs.readFileSync(dbFilePath, 'utf8');

    // If the file is empty or contains invalid JSON, initialize it with an empty JSON object
    if (!fileContent || fileContent.trim() === '' || !isValidJson(fileContent)) {
      fs.writeFileSync(dbFilePath, '{}');
    }
  } else {
    console.log('file not found')
  }
  const currentDate = new Date();
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      // const currentTimeStamp = dateUTC.getTime();
      const formattedDate = `${year}-${month}-${day}`;
  const TripRouteDto = database.collection("TripRouteDto");
  const query = { status: "STARTED", date: formattedDate}
  const queryData = await TripRouteDto.find(query).toArray();
  if (queryData && queryData.length > 0) {
    for (let r = 0; r < queryData.length; r++) {
      await registerStartedTrip(queryData[r])
    }
  }
}

const registerStartedTrip = async(queryData) => {
try {


  const path = "/StartedTrips";
  let startedTrips = [];
    let vehicleNos = []
    vehicleNos.push(queryData.vehicleNo)
  

    Object.assign(queryData, { "tripStatus": queryData.status, "tripId": queryData._id.toString() })
    

    const gpsDevices = database.collection("GpsDevices");
    const gpData = await gpsDevices
      .aggregate([
        { $match: { vehicleNumberPlate: { $in: vehicleNos } } },
        {
          $lookup: {
            from: "VehicleReg",
            localField: "vehicleNumberPlate",
            foreignField: "vehicleNumberPlate",
            as: "Vehicle",
          },
        },
        {
          $unwind: "$Vehicle",
        },
      ])
      .toArray();


    const tripAndGpsDeviceData = { ...gpData[0], ...queryData }

      startedTrips.push(tripAndGpsDeviceData);
      await startedTripsJsonDB.push(path, startedTrips)
    
  
} catch (error) {
  const path = "/StartedTrips";
  await startedTripsJsonDB.push(path, [{ id: "Test" }]);
}
}

module.exports = { mapGpsToCorps, populateCorpSetting, populateStartedTrips };
