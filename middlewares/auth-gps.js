require("dotenv").config();
const fetch = require("node-fetch");
const BSON = require("bson");
const client = require("../mongodb");
//const dbName = "etravelmat"; //DEV
//  const dbName = "travelmat"; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;
const database = client.db(dbName);
const GpsDeviceLiveDataJsonDb = require('../localJsonDbConfig/gpsDeviceLiveDataDb');
const authGps = async (req, res, next) => {
  // const fs = require("fs");
  // var logger = fs.createWriteStream('logs/gpsDataLive.txt', {
  //   flags: 'a' // 'a' means appending (old data will be preserved)
  // })

  // var writeLine = (line) => logger.write(`\n${line}`);



  const currentDate = new Date();
  let timeString = currentDate.getDate() + "-" + (currentDate.getMonth() + 1) + "-" + currentDate.getFullYear() + "-" + currentDate.getHours() + ":" + currentDate.getMinutes();

  const devicesData = req.body;
  let panicAlert;
  for(let p=0;p<devicesData.length;p++){
    if(devicesData[p].alertMap && devicesData[p].alertMap.PANIC){
      panicAlert = devicesData[p];
      
    }
  }


  const correctData = devicesData.map(item => {
    const firstString = item.timestamp.slice(0, -3);
    const secondString = item.timestamp.slice(-3);
    const dateObj = new Date(firstString + '.' + secondString);
    return { correctedFormatTimestamp: dateObj.getTime(), ...item };
  })
  const sortedData = correctData.sort((a, b) => b.correctedFormatTimestamp - a.correctedFormatTimestamp);
  const uniqueObjectsMap = new Map();
  // Iterate over the sorted array
  sortedData.forEach(obj => {
    // Add objects to the Map only if their id is not already present
    if (!uniqueObjectsMap.has(obj.deviceImei)) {
      uniqueObjectsMap.set(obj.deviceImei, obj);
    }
  });

  // Extract the values (unique objects) from the Map
  const uniqueObjects = Array.from(uniqueObjectsMap.values());

  //864356066325599
  //864356061191246
  //868053057550634
  
  //const uniqueDeviceData = uniqueObjects.filter(item => item.deviceImei == "864356061191246")
  const uniqueDeviceData = uniqueObjects;
  if (uniqueDeviceData && uniqueDeviceData.length > 0) {
    // let allDeviceData = [];
    for (let i = 0; i < uniqueDeviceData.length; i++) {

      try {

        const currentDate = new Date();
        const updatedDeviceData = await calculateHeading(uniqueDeviceData[i]);
        await GpsDeviceLiveDataJsonDb.push("/" + uniqueDeviceData[i].deviceImei, { ...updatedDeviceData, ...{ localTimeStamp: currentDate.getTime() } });
      } catch (err) {

      }

    }
  }
  req.panicAlert = panicAlert;
  next();
};

const calculateHeading = async(latestDeviceData) => {
  console.log(latestDeviceData, "Latest Data+++++", latestDeviceData.deviceImei)
  try {
  if(latestDeviceData.deviceImei){  
  const startingPoint = await GpsDeviceLiveDataJsonDb.getData("/"+latestDeviceData.deviceImei);
  console.log(startingPoint, "Previous Data++++++", latestDeviceData.deviceImei)
  const lat1 = startingPoint.latitude;
  const lon1 = startingPoint.longitude;
  const lat2 = latestDeviceData.latitude;
  const lon2 = latestDeviceData.longitude;
  const heading = await getRhumbLineBearing(lat1, lon1, lat2, lon2);
  //const heading = await calculateInitialCompassBearing(lat1, lon1, lat2, lon2);
  const tranform = await calculateAngle(lat1, lon1, lat2, lon2);
  console.log(heading, latestDeviceData.deviceImei, "Nero Headding Data+++++")
  latestDeviceData.bearing = heading?heading:0
  latestDeviceData.tranform = tranform?tranform:0;
  return latestDeviceData
  }
} catch (error) {
    console.log(error, "Error in Auth-gps.js File")
}
}

async function getRhumbLineBearing(lat1, lon1, lat2, lon2) {
  // Convert degrees to radians
  lat1 = lat1 * Math.PI / 180;
  lon1 = lon1 * Math.PI / 180;
  lat2 = lat2 * Math.PI / 180;
  lon2 = lon2 * Math.PI / 180; 

  // Compute delta longitude
  var dLon = lon2 - lon1; 

  // Compute the rhumb line bearing
  var y = Math.sin(dLon) * Math.cos(lat2);
  var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  var bearing = Math.atan2(y, x); 

  // Convert bearing from radians to degrees 
  bearing = (bearing * 180 / Math.PI + 360) % 360; 

  return bearing.toFixed(2); 
}

async function calculateInitialCompassBearing(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  // Calculate differences in longitudes and latitudes
  const deltaLon = lon2Rad - lon1Rad;
  const deltaPhi = Math.log(Math.tan(lat2Rad / 2 + Math.PI / 4) / Math.tan(lat1Rad / 2 + Math.PI / 4));

  // Calculate the initial bearing angle
  let initialBearing = Math.atan2(deltaLon, deltaPhi);

  // Convert bearing from radians to degrees
  initialBearing = toDegrees(initialBearing);

  // Normalize the initial bearing to a compass heading (0-360)
  const compassBearing = (initialBearing + 360) % 360;
  
  return compassBearing.toFixed(2);
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

async function calculateAngle(lat1, lon1, lat2, lon2) {
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let angle = Math.atan2(y, x);
  angle = (angle * 180) / Math.PI; // Convert radians to degrees
  return angle;
}

module.exports = authGps;
