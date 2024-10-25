const { initializeSentry } = require('./sentry.js');
const Sentry = require('@sentry/node');
initializeSentry();
const express = require('express');
const cors = require('cors');
const socket = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger-output.json');
const app = express();
const router = require('express').Router();
const authGps = require('./middlewares/auth-gps.js');
const { startScheduler } = require('./controller/ivr.controller/index.js');
const kafkaProducer = require('./controller/kafka.controller/kafka.producer.controller.js');
const liveTrackingCount = require('./controller/kafka.controller/liveTrackingCount.consumer.controller.js');
const vehicleNearSite = require('./controller/kafka.controller/nearSiteVehicle.consumer.js');
const employeeSOS = require('./controller/kafka.controller/employeeSOS.consumer.js');
const driverSOS = require('./controller/kafka.controller/driverSOS.consumer.js');
const specialEmployee = require('./controller/kafka.controller/specialEmployee.consumer.js');
const adhocTrip = require('./controller/kafka.controller/adhcoTrip.consumer.js');
const femaleTrip = require('./controller/kafka.controller/femaleTrip.consumer.js');
const firstPickupDelay = require('./controller/kafka.controller/firstPickUpDelay.consumer.js');
const escortTrip = require('./controller/kafka.controller/escort.consumer.js');
const expectedFirstPickUpDelay = require('./controller/kafka.controller/expectedFirstpickup.consumer.js');

const turf = require('@turf/turf');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
const { JsonDB, Config } = require('node-json-db');
// const { MongoClient } = require('mongodb');
const jsonDB = new JsonDB(new Config('jsonDb', true, false, '/'));
const corporateSettingJsonDb = new JsonDB(
  new Config('corporateSettingJsonDb', true, false, '/')
);

const client = require('./mongodb');
const routeDeviationDb = require('./localJsonDbConfig/routeDeviationDb.js');
const coveredRouteCordsDb = require('./localJsonDbConfig/coveredRouteCordsDb.js');
const GpsDeviceLiveDataJsonDb = require('./localJsonDbConfig/gpsDeviceLiveDataDb.js');
const startedTripsJsonDB = require('./localJsonDbConfig/startedTripsDB.js');
const lastTimeGoogleApiCalledDB = require('./localJsonDbConfig/lastTimeGoogleApiCalledDB.js');
const deviceCorporateMappingDb = require('./localJsonDbConfig/deviceCorporateMappingDb.js');
const intializeSecondSocket = require('./controller/waiting_timer/index.js');
const intializeInTripChatBot = require('./controller/routeMessage.controller/index.js');
const dbName = process.env.DATABASE;
// const database = client.db(dbName);

const mongoose = require('mongoose');
// mongoose.connect('mongodb+srv://eTravelMate:na36NnPr3YyEu1bi@cluster0.1qig8hs.mongodb.net/travelmat?retryWrites=true&w=majority').then( () => console.log("mongo connected")).catch(err => console.log(err));
mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('mongo connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

//const dbName = "etravelmat"; //DEV
//  const dbName = "travelmat"; //UAT
//const dbName = 'etravelmateprod'; //PROD
const database = client.db(dbName);
var allRunningGpsDevices = [];
var outDatedGpsDevices = [];
var checkInDuration = 7; // In seconds
var CallGoogleMapApiEveryMins = 1;
var stoppageAlertArray = [];
var intervalRef;
var overSpeedingTrips = [];
var sendOverSpeedNotificationAfter = 300; //In Seconds

const {
  mapGpsToCorps,
  populateCorpSetting,
  populateStartedTrips,
} = require('./components/populateJsonDb.js');
mapGpsToCorps();
populateCorpSetting();
populateStartedTrips();
//startInterval();
async function main() {
  try {
    // Connect to the MongoDB cluster
    await client.connect();

    const pipeline = [
      {
        $match: {
          operationType: {
            $in: ['insert', 'update'],
          },
        },
      },
    ];

    monitorListingsUsingEventEmitter(client, 30000, pipeline);
  } finally {
    // Close the connection to the MongoDB cluster
    // await client.close();
  }
}

main().catch(console.error);

function closeChangeStream(timeInMs = 60000, changeStream) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Closing the change stream');
      changeStream.close();
      resolve();
    }, timeInMs);
  });
}

app.use(cors());

/*var corsOptions = {
  origin: "http://localhost:8081"
};*/

// app.use(cors(corsOptions));
// app.use(cors());

// parse requests of content-type - application/json
app.use(express.json());

startScheduler();
app.use(express.urlencoded({ extended: true }));
Sentry.setupExpressErrorHandler(app);
app.use('/api/dashboard', require('./routes'));
app.use('/api/devices', require('./routes'));
app.use('/api/routeMessage', require('./routes'));
app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
app.use('/api/gps-devices', router);

router.post('/associate-gpsdevice-corp', async (req, res) => {
  const deviceImei = req.body[0].deviceImei;
  const associatedCorps = req.body;
  if (deviceImei) {
    const path = '/' + deviceImei;
    try {
      await deviceCorporateMappingDb.push(path, associatedCorps);
    } catch (error) {
      await deviceCorporateMappingDb.push(path, associatedCorps);
    }
  }

  res.status(200).json({ status: '1', message: 'Data updated successfully' });
});

router.get('/get-data-from-json-file', async (req, res) => {
  const fileName = req.query.fileName;
  let dataPath = '/';
  if (req.query.path != '') {
    dataPath = '/' + req.query.path;
  }

  let jsonData;
  const dbConfName = {
    routeDeviationDb: routeDeviationDb,
    coveredRouteCordsDb: coveredRouteCordsDb,
    GpsDeviceLiveDataJsonDb: GpsDeviceLiveDataJsonDb,
    startedTripsDb: startedTripsJsonDB,
    lastTimeGoogleApiCalledDB: lastTimeGoogleApiCalledDB,
    deviceCorporateMappingDb: deviceCorporateMappingDb,
    jsonDb: jsonDB,
    corporateSettingJsonDb: corporateSettingJsonDb,
  };

  try {
    jsonData = await dbConfName[fileName].getData(dataPath);
  } catch (error) {
    if (error) {
      jsonData = {};
    }
  }

  res.status(200).json({
    status: '1',
    message: 'Data retrieved successfully',
    data: jsonData,
  });
});
const port = process.env.PORT || 3000; // setting the port
let server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});

app.use(require('./routes/index.js'));

const io = socket(server, {
  path: '/api/socket.io/',
  cors: {
    origin: '*',
    credentials: true,
  },
});

// io.on('connection', function(socket) {
//     console.log('socket :>> ', socket.id);
//     // Use socket to communicate with this particular client only, sending it it's own id
//     socket.emit('welcome', { message: 'Welcome!', id: socket.id });

//     socket.on('i am client', console.log);
// });

global.onlineUsers = new Map();
global.liveVehicles = new Map();

io.on('connection', (socket) => {
  global.chatSocket = socket;
  socket.on('add-user', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
  });

  socket.on('send-msg', (data) => {
    console.log('data :>> ', data);
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit('msg-recieve', data.message);
    }
  });

  socket.on('get-live-data', async (data) => {
    //console.log('get-live-data :>> ', data);
    const sendCorpSocket = onlineUsers.get(data.corpId);
    var allVch = await jsonDB.getData('/' + data.date + '/' + data.corpId);
    if (sendCorpSocket) {
      console.log('allVch', allVch);
      socket.to(sendCorpSocket).emit('live-vehicles', allVch);
    }
  });

  socket.on('live', async (data) => {
    //console.log("add vehicle>>>>", data);
    const { vehicleId, ...rest } = data;
    const sendCorpSocket = onlineUsers.get(data.corpId);

    // await jsonDB.push("/"+data.date+"/"+data.corpId+"/"+data.vehicleId,{socketId: socket.id, ...data});

    // var allVch = await jsonDB.getData("/"+data.date+"/"+data.corpId);
    if (sendCorpSocket) {
      // socket.to(sendCorpSocket).emit("live-vehicles", allVch);
      if (data && data.gpsTrackingMode == 'Mobile Gps') {
        await jsonDB.push(
          '/' + data.date + '/' + data.corpId + '/' + data.vehicleId,
          { socketId: socket.id, ...data }
        );

        var allVch = await jsonDB.getData('/' + data.date + '/' + data.corpId);
        await sendSpeedAlert(data);
        socket.to(data.corpId).emit('live-vehicles', allVch);
      }
      if (data && data.gpsTrackingMode == 'Vehicle Gps') {
        if (
          data &&
          data.tripStatus == 'STARTED' &&
          allRunningGpsDevices &&
          allRunningGpsDevices.length > 0
        ) {
          for (let r = 0; r < allRunningGpsDevices.length; r++) {
            var dateUTC = new Date();

            // var dateUTC = dateUTC.getTime()
            // var dateIST = new Date(dateUTC);
            // //date shifting for IST timezone (+5 hours and 30 minutes)
            // dateIST.setHours(dateIST.getHours() + 5);
            // dateIST.setMinutes(dateIST.getMinutes() + 30);
            // const currentTimeStamp = dateIST.getTime();
            const currentTimeStamp = dateUTC.getTime();
            const differenceInMilliseconds = Math.abs(
              currentTimeStamp - allRunningGpsDevices[r].updatedOn
            );

            const differenceInSeconds = Math.round(
              differenceInMilliseconds / 1000
            );
            // console.log(differenceInSeconds, currentTimeStamp,  allRunningGpsDevices[r].updatedOn, "Nero time differnece")
            const GpsDataGainLoss = database.collection('GpsDataGainLoss');
            if (differenceInSeconds > checkInDuration) {
              const alreadyExistsInArray = outDatedGpsDevices.some(
                (object) => object.tripId === allRunningGpsDevices[r].tripId
              );
              if (!alreadyExistsInArray) {
                const gpsLost = {
                  tripId: allRunningGpsDevices[r].tripId,
                  gpsDeviceImei: allRunningGpsDevices[r].gpsDeviceImei,
                  vendorId: allRunningGpsDevices[r].vendorId,
                  corpId: allRunningGpsDevices[r].corpId,
                  location: allRunningGpsDevices[r].location,
                  singnal: 'LOST',
                  updatedTime: currentTimeStamp,
                };
                await GpsDataGainLoss.insertOne(gpsLost);
                outDatedGpsDevices.push(allRunningGpsDevices[r]);
              }
            } else {
              const alreadyExistsInArray = outDatedGpsDevices.some(
                (object) => object.tripId === allRunningGpsDevices[r].tripId
              );
              if (alreadyExistsInArray) {
                const gpsGain = {
                  tripId: allRunningGpsDevices[r].tripId,
                  gpsDeviceImei: allRunningGpsDevices[r].gpsDeviceImei,
                  vendorId: allRunningGpsDevices[r].vendorId,
                  corpId: allRunningGpsDevices[r].corpId,
                  location: allRunningGpsDevices[r].location,
                  singnal: 'GAIN',
                  updatedTime: currentTimeStamp,
                };
                await GpsDataGainLoss.insertOne(gpsGain);
                //  outDatedGpsDevices.push(allRunningGpsDevices[r]);
                const updatedArrayOutDatedGpsDevices =
                  outDatedGpsDevices.filter(
                    (obj) => obj.tripId !== allRunningGpsDevices[r].tripId
                  );
                outDatedGpsDevices = updatedArrayOutDatedGpsDevices;
              }
            }
          }
        }

        //Case Handled: If trip is running and using GPS device tracking. In any case if GPS device
        //not working then tracking will be switched to mobile automatically.
        if (outDatedGpsDevices && outDatedGpsDevices.length > 0) {
          await jsonDB.push(
            '/' + data.date + '/' + data.corpId + '/' + data.vehicleId,
            { socketId: socket.id, ...data }
          );

          var allVch = await jsonDB.getData(
            '/' + data.date + '/' + data.corpId
          );
          for (let g = 0; g < outDatedGpsDevices.length; g++) {
            if (outDatedGpsDevices[g].tripId == data.tripId) {
              await sendSpeedAlert(data);
              socket.to(data.corpId).emit('live-vehicles', allVch);
            }
          }
        }
        //Case Handled: If GPS device is broken and not working. Then Mobile tracking will work.
        // This will work if vehicles are secheduled to track using GPS device but GPS device broken
        // or something else. then for upcoming trips mobile tracking will work.
        const allRunningGpsDevicesCount = allRunningGpsDevices.length;
        if (allRunningGpsDevicesCount > 0) {
          await jsonDB.push(
            '/' + data.date + '/' + data.corpId + '/' + data.vehicleId,
            { socketId: socket.id, ...data }
          );

          var allVch = await jsonDB.getData(
            '/' + data.date + '/' + data.corpId
          );
          const tripFound = allRunningGpsDevices.find(
            (item) => item.tripId == data.tripId
          );
          if (typeof tripFound === 'undefined' && tripFound == undefined) {
            socket.to(data.corpId).emit('live-vehicles', allVch);
          }
        }
      }
    }
  });

  router.post('/live-data', authGps, async (req, res) => {
    if (req && req.panicAlert) {
      console.log(
        'Panic Alert Reported+++++++++++++++++++++++++++++++++++++++++++'
      );
      sendPanicAlert(req.panicAlert, socket, io);
    }
    res.status(200).json({
      text: 'Success from VSPL SERVER',
      response: { data: req.body, gps: req.body },
    });
  });

  router.get('/update-driver-setting', async (req, res) => {
    const driverSettingId = req.query.driver_setting_id;
    const ObjectId = require('mongodb').ObjectId;
    const obId = new ObjectId(driverSettingId);
    const query = { _id: obId };
    const DriverSetting = database.collection('DriverSetting');
    const driverSettings = await DriverSetting.findOne(query);
    if (driverSettings && Object.keys(driverSettings).length > 0) {
      const path = '/' + driverSettings.corporateId;
      await corporateSettingJsonDb.push(path, driverSettings);
    }
    res.status(200).json({ status: '1', message: 'Data updated successfully' });
  });

  //API is called from Java End to notify that trip has been started. So trigger SetInterval
  router.get('/trip-started', async (req, res) => {
    if (!intervalRef) {
      // await registerStartedTripInJsonDb(req.query.tripId);
      intervalRef = setInterval(async () => {
        await CallFunctionBasedOnInterval();
        // Perform your desired task here
      }, 6000); // Interval duration in milliseconds
      res.status(200).json({
        status: 1,
        message: 'Thanks for notify me about trip started',
      });
    } else {
      await registerStartedTripInJsonDb(req.query.tripId);
      res.status(200).json({
        status: 1,
        message: 'Thanks for notify me about trip started',
      });
    }
  });

  //API is called from Java End to notify that trip has been completed. So Clear the SetInterval
  router.get('/trip-completed', async (req, res) => {
    const path = '/StartedTrips';
    let startedTrips = await startedTripsJsonDB.getData(path);
    const remainingStartedTrips =
      startedTrips &&
      startedTrips.filter((item) => item.tripId != req.query.tripId);
    const remaingOSTrips = overSpeedingTrips.filter(
      (item) => item.tripId != req.query.tripId
    );
    overSpeedingTrips = remaingOSTrips;
    const remainStopageAlerts = stoppageAlertArray.filter(
      (ele) => ele.tripId != req.query.tripId
    );
    stoppageAlertArray = remainStopageAlerts;
    const restRunningTrips = allRunningGpsDevices.filter(
      (rec) => rec.tripId != req.query.tripId
    );
    allRunningGpsDevices = restRunningTrips;
    if (intervalRef) {
      //overSpeedingTrips = overSpeedingTrips.filter((someObj)=> someObj.tripId != req.query.tripId)

      if (remainingStartedTrips && remainingStartedTrips.length < 1) {
        await startedTripsJsonDB.push(path, []);
        // clearInterval(intervalRef);
        // intervalRef = null;
        res.status(200).json({
          status: 1,
          message: 'Thanks for notify me about trip completed',
        });
      } else {
        await startedTripsJsonDB.push(path, remainingStartedTrips);
        res.status(200).json({
          status: 1,
          message: 'Thanks for notify me about trip completed',
        });
      }
    } else {
      await startedTripsJsonDB.push(path, remainingStartedTrips);
      res.status(200).json({
        status: 1,
        message: 'Thanks for notify me about trip completed',
      });
    }
  });

  socket.on('live-disconnect', (data) => {
    const { id, ...rest } = data;
    liveVehicles.delete(id);
    const allVehiclesForVendor = liveVehicles.filter(
      (vd) => vd.vendorId == data.vendorId
    );
    const allVehiclesForCorp = liveVehicles.filter(
      (vd) => vd.corpId == data.corpId
    );
    const sendVendorSocket = onlineUsers.get(data.vendorId);
    const sendCorpSocket = onlineUsers.get(data.corpId);
    if (sendVendorSocket) {
      socket.to(sendVendorSocket).emit('live-vehicles', allVehiclesForVendor);
    }
    if (sendCorpSocket) {
      socket.to(sendCorpSocket).emit('live-vehicles', allVehiclesForCorp);
    }
  });

  socket.on('send-location', (data) => {
    data.to.forEach((to) => {
      const sendUserSocket = onlineUsers.get(to);
      if (sendUserSocket) {
        // socket.to(sendUserSocket).emit("location-recieve", data.location);
        socket.to(to).emit('location-recieve', data.location);
      }
    });
  });

  socket.on('update-to-driver', (data) => {
    //console.log("data update-to-driver:>> ", data);
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit('recive-from-employee', data.update);
    }
  });

  socket.on('update-to-employee', (data) => {
    //console.log("data update-to-driver:>> ", data);
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit('update-from-driver', data.update);
    }
  });

  socket.on('join', (room) => {
    socket.join(room);
    //console.log('room', room)
  });

  socket.on('send-room-msg', (data) => {
    //console.log('room data :>> ', data);
    io.sockets.in(data.room).emit('msg-room-recieve', data.message);
  });

  socket.on('send-room-typing', (data) => {
    //console.log('room data :>> ', data);
    io.sockets.in(data.room).emit('msg-room-typing', data.typing);
  });

  socket.on('send-sos', (data) => {
    //console.log('sos data :>> ', data);
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      //console.log('sos trigger :>> ', data);
      socket.to(sendUserSocket).emit('sos-trigger', data.sos);
    } else {
    }
  });

  socket.on('send-direction', (data) => {
    // const sendUserSocket = onlineUsers.get(data.to);
    // if (sendUserSocket) {
    //   socket.to(sendUserSocket).emit("sos-trigger", data.sos);
    // } else {
    // }
  });

  // const sendDataOfNonRunningVehiclesBK = async () => {
  //   let allVehiclesGpDeviceData = await GpsDeviceLiveDataJsonDb.getData("/");
  //   console.log(allRunningGpsDevices, 'Running trips in Corps+++++++++++++')
  //   const vehiclesDataArray = Object.keys(allVehiclesGpDeviceData).map(key => ({
  //     ...allVehiclesGpDeviceData[key],
  //     deviceImei: key
  //   }));
  //   const allVehiclesCount = vehiclesDataArray.length;
  //   const socketData = {};
  //   for (let r = 0; r < allVehiclesCount; r++) {
  //     const isVehicleRunning = allRunningGpsDevices.some(obj => obj.gpsDeviceImei === vehiclesDataArray[r].deviceImei);
  //     if (!isVehicleRunning) {
  //       const path = "/" + vehiclesDataArray[r].deviceImei;
  //       try {

  //         const dataRecivers = await deviceCorporateMappingDb.getData(path);
  //         for (let p = 0; p < dataRecivers.length; p++) {
  //           if (dataRecivers[p].deviceImei = vehiclesDataArray[r].deviceImei && dataRecivers[p].gpsTrackingMode == "Vehicle Gps") {
  //             const location = {
  //               "lat": vehiclesDataArray[r].latitude,
  //               "lng": vehiclesDataArray[r].longitude,
  //               "heading": vehiclesDataArray[r].bearing,
  //               "battery": "0",
  //               "driverName": dataRecivers[p].driverName,
  //               "driverMobileNo": dataRecivers[p].driverMobilNo,
  //               "driverPhoto": process.env.APP_DOMAIN + "/user-reg/download-file/img-file?fileurl=" + dataRecivers[p].driverPhoto,
  //               "vehicleNo": dataRecivers[p].vehicleNo,
  //               "vehicleType": dataRecivers[p].vehicleType,
  //               "tid": "NO_TRIP",
  //               "tripId": "NO_TRIP"
  //             }
  //             socketData[dataRecivers[p].corpId] = { ...socketData[dataRecivers[p].corpId], [dataRecivers[p].vehicleId]: { ...dataRecivers[p], ...vehiclesDataArray[r], ...{ location: location } } }

  //           }
  //         }
  //       } catch (error) {

  //       }

  //     }
  //   }

  //   const socketDataCorpWise = Object.entries(socketData).map(([key, value]) => ({
  //     key,
  //     value
  //   }));

  //   for (let g = 0; g < socketDataCorpWise.length; g++) {
  //     const ele = socketDataCorpWise[g];
  //     socket.to(ele.key).emit("live-vehicles", ele.value);
  //   }

  // }

  const sendDataOfNonRunningVehicles = async () => {
    let allVehiclesGpDeviceData = await GpsDeviceLiveDataJsonDb.getData('/');
    const vehiclesDataArray = Object.keys(allVehiclesGpDeviceData).map(
      (key) => ({
        ...allVehiclesGpDeviceData[key],
        deviceImei: key,
      })
    );
    const allVehiclesCount = vehiclesDataArray.length;
    const socketData = {};
    for (let r = 0; r < allVehiclesCount; r++) {
      const isVehicleRunning = allRunningGpsDevices.some(
        (obj) => obj.gpsDeviceImei === vehiclesDataArray[r].deviceImei
      );
      if (!isVehicleRunning) {
        const path = '/' + vehiclesDataArray[r].deviceImei;
        try {
          const dataRecivers = await deviceCorporateMappingDb.getData(path);
          for (let p = 0; p < dataRecivers.length; p++) {
            if (
              (dataRecivers[p].deviceImei =
                vehiclesDataArray[r].deviceImei &&
                dataRecivers[p].gpsTrackingMode == 'Vehicle Gps')
            ) {
              const location = {
                lat: vehiclesDataArray[r].latitude,
                lng: vehiclesDataArray[r].longitude,
                heading: vehiclesDataArray[r].bearing,
                battery: '0',
                driverName: dataRecivers[p].driverName,
                driverMobileNo: dataRecivers[p].driverMobilNo,
                driverPhoto:
                  process.env.APP_DOMAIN +
                  '/user-reg/download-file/img-file?fileurl=' +
                  dataRecivers[p].driverPhoto,
                vehicleNo: dataRecivers[p].vehicleNo,
                vehicleType: dataRecivers[p].vehicleType,
                tid: 'NO_TRIP',
                tripId: 'NO_TRIP',
              };
              socketData[dataRecivers[p].corpId] = {
                ...socketData[dataRecivers[p].corpId],
                [dataRecivers[p].vehicleId]: {
                  ...dataRecivers[p],
                  ...vehiclesDataArray[r],
                  ...{ location: location },
                  ...{ socketId: socket.id },
                },
              };
              // socketData[dataRecivers[p].vehicleId] = { ...dataRecivers[p], ...vehiclesDataArray[r], ...{location: location} }
              //console.log(socketData, "Nero socket data+++++++++++++++++")
              ///socket.to(dataRecivers[p].corpId).emit("live-vehicles", socketData);
            }
          }
        } catch (error) {}
      }
    }

    const socketDataCorpWise = Object.entries(socketData).map(
      ([key, value]) => ({
        key,
        value,
      })
    );

    return socketDataCorpWise;
  };

  const CallFunctionBasedOnInterval = async () => {
    const path = '/StartedTrips';
    let tripDetailDeviceVechileArray = await startedTripsJsonDB.getData(path);
    const startedTripsCount = tripDetailDeviceVechileArray.length;
    var runningTripsArray = [];
    if (startedTripsCount > 0) {
      for (let t = 0; t < startedTripsCount; t++) {
        try {
          const funcResponse = await getTripDetail(
            tripDetailDeviceVechileArray[t]
          );
          const data = funcResponse.cookedData;
          const tripInfo = funcResponse.tripInfo;
          if (data && data.tripId) {
            if (data && data.tripStatus == 'STARTED') {
              try {
                const currentDateForGAPI = new Date();
                const currentDateForGApiTS = currentDateForGAPI.getTime();
                const path = '/lastTimeGoogleApiCalledDB/' + data.tripId;
                // await corporateSettingJsonDb.push(path, currentDateForGApiTS);
                let lastApiCalledTime = await lastTimeGoogleApiCalledDB.getData(
                  path
                );
                const differenceInMilliseconds = Math.abs(
                  currentDateForGApiTS - lastApiCalledTime
                );

                const differenceInSeconds = Math.round(
                  differenceInMilliseconds / 1000
                );
                // console.log(differenceInSeconds, CallGoogleMapApiEveryMins * 60, "Call Google API for ETA+++++++++++++++++")
                if (differenceInSeconds > CallGoogleMapApiEveryMins * 60) {
                  data.stopPointsDynamicETA =
                    await calculateStopPointsDynamicETA(
                      data.location,
                      tripInfo
                    );
                }
                // if (t + 1 == startedTripsCount) {
                //   await corporateSettingJsonDb.push(path, currentDateForGApiTS);
                // }
              } catch (error) {
                const currentDateForGAPI = new Date();
                const currentDateForGApiTS = currentDateForGAPI.getTime();
                const path = '/lastTimeGoogleApiCalledDB/' + data.tripId;
                await lastTimeGoogleApiCalledDB.push(
                  path,
                  currentDateForGApiTS
                );
                data.stopPointsDynamicETA = await calculateStopPointsDynamicETA(
                  data.location,
                  tripInfo
                );
              }
            }

            await jsonDB.push(
              '/' + data.date + '/' + data.corpId + '/' + data.vehicleId,
              { socketId: socket.id, ...data }
            );
            var allVch = await jsonDB.getData(
              '/' + data.date + '/' + data.corpId
            );
            // if (sendCorpSocket) {

            if (data && data.gpsTrackingMode == 'Vehicle Gps') {
              // socket.to("645caf975115e85968471fcf").emit("live-vehicles", allVch);
              if (data && data.corpId) {
                if (data && data.tripStatus == 'STARTED') {
                  // socket.to(data.corpId).emit("live-vehicles", allVch);
                  runningTripsArray.push({ key: data.corpId, value: allVch });
                  const exists = allRunningGpsDevices.some(
                    (obj) => obj.tripId === data.tripId
                  );
                  if (!exists) {
                    allRunningGpsDevices.push({
                      tripId: data.tripId,
                      updatedOn: data.updatedOn,
                      gpsDeviceImei: data.gpsDeviceImei,
                      vendorId: data.vendorId,
                      corpId: data.corpId,
                      location: data.location,
                    });
                  } else {
                    for (const obj of allRunningGpsDevices) {
                      if (obj.tripId == data.tripId) {
                        obj.updatedOn = data.updatedOn;
                        obj.location = data.location;
                      }
                    }
                  }

                  // if (data && data.panicAlert == 1) {
                  //   await sendPanicAlert(data, socket);
                  // }
                  await sendStopageAlert(data);
                  await sendSpeedAlert(data);
                  await sendRouteDeviationAlert(data, tripInfo);
                  const empAndStopData = await getTripEmployees(tripInfo);
                  empAndStopData.empIds &&
                    empAndStopData.empIds.length > 0 &&
                    empAndStopData.empIds.forEach((to) => {
                      const sendUserSocket = onlineUsers.get(to);
                      const dataToSend = {
                        lat: data.location.lat,
                        long: data.location.lng,
                        heading: Number(data.location.heading),
                        stopPointsDynamicETA: null,
                        id: empAndStopData.stopPoint._id,
                      };
                      if (sendUserSocket) {
                        socket.to(to).emit('location-recieve', dataToSend);
                      }
                    });
                } else {
                  if (data && data.tripStatus == 'STARTED') {
                    allRunningGpsDevices = allRunningGpsDevices.filter(
                      (item) => item.tripId != data.tripId
                    );

                    const tripExist = stoppageAlertArray.find(
                      (item) => item.tripId == data.tripId
                    );
                    if (tripExist) {
                      let filteredTrips = stoppageAlertArray.filter(
                        (item) => item.tripId != tripExist.tripId
                      );
                      stoppageAlertArray = filteredTrips;
                    }
                  }
                }
                //console.log(allVch, "Nero tttttttttttttttttttttttttttttttttt");
                console.log(
                  allRunningGpsDevices,
                  'Nero running GPS devices all'
                );
                //console.log(outDatedGpsDevices, "Nero outDated Devices all")
              }
            }
          }
        } catch (error) {
          console.log(error, 'Nero Error');
        }
      }
    } else {
      console.log('NO RUNNING TRIP FOUND');
    }

    const idleVehiclesData = await sendDataOfNonRunningVehicles();
    var merged = {};
    runningTripsArray.forEach((item) => {
      merged[item.key] = { ...merged[item.key], ...item.value };
    });

    // Merge array p into merged object
    idleVehiclesData.forEach((item) => {
      merged[item.key] = { ...merged[item.key], ...item.value };
    });

    // Convert merged object back to an array
    var mergedArray = Object.entries(merged).map(([key, value]) => ({
      key,
      value,
    }));

    for (let g = 0; g < mergedArray.length; g++) {
      const ele = mergedArray[g];
      socket.to(ele.key).emit('live-vehicles', ele.value);
    }
  };
});

server.setMaxListeners(20);

intializeSecondSocket.waitingSocket(server);
intializeInTripChatBot.inTripChat(server);
kafkaProducer.kafkaProducerSocket(server);
liveTrackingCount.liveTrackingCountSocket(server);
vehicleNearSite.vehicleNearSiteSocket(server);
employeeSOS.employeeSOSSocket(server);
driverSOS.driverSOSSocket(server);
specialEmployee.specialEmployeeSocket(server);
adhocTrip.adhocTripSocket(server);
femaleTrip.femaleTripSocket(server);
firstPickupDelay.fristPickupDelaySocket(server);
escortTrip.escortTripSocket(server);
expectedFirstPickUpDelay.expectedFirstPickUpDelaySocket(server);

async () => {
  try {
    await kafkaService.runConsumer();
  } catch (error) {
    console.log(`Error:`, error);
  }
};

const registerStartedTripInJsonDb = async (tripId) => {
  try {
    const path = '/StartedTrips';
    let startedTrips = await startedTripsJsonDB.getData(path);

    const ObjectId = require('mongodb').ObjectId;
    const obId = new ObjectId(tripId);
    const query = { _id: obId };
    const TripRouteDto = database.collection('TripRouteDto');
    const queryData = await TripRouteDto.find(query).toArray();
    if (queryData && queryData.length > 0) {
      let vehicleNos = [];
      for (let r = 0; r < queryData.length; r++) {
        vehicleNos.push(queryData[r].vehicleNo);
      }

      queryData &&
        queryData.map((item) => {
          return Object.assign(item, {
            tripStatus: item.status,
            tripId: item._id.toString(),
          });
        });

      const gpsDevices = database.collection('GpsDevices');
      const gpData = await gpsDevices
        .aggregate([
          { $match: { vehicleNumberPlate: { $in: vehicleNos } } },
          {
            $lookup: {
              from: 'VehicleReg',
              localField: 'vehicleNumberPlate',
              foreignField: 'vehicleNumberPlate',
              as: 'Vehicle',
            },
          },
          {
            $unwind: '$Vehicle',
          },
        ])
        .toArray();

      const tripAndGpsDeviceData = { ...gpData[0], ...queryData[0] };

      const exists = startedTrips.some((item) => item.tripId === tripId);
      if (!exists) {
        startedTrips.push(tripAndGpsDeviceData);
        await startedTripsJsonDB.push(path, startedTrips);
      }
    }
  } catch (error) {
    const path = '/StartedTrips';
    await startedTripsJsonDB.push(path, [{ id: 'Test' }]);
  }
};

async function monitorListingsUsingEventEmitter(
  clt,
  timeInMs = 60000,
  pipeline = []
) {
  const collection = clt.db('travelmat').collection('TripDirections');
  const changeStream = collection.watch(pipeline, {
    fullDocument: 'updateLookup',
  });
  changeStream.on('change', (next) => {
    next.fullDocument.reciverIds.forEach((element) => {
      const sendUserSocket = onlineUsers.get(element);
      if (sendUserSocket) {
        console.log('direction change', next);
        io.to(sendUserSocket).emit('get-direction', next);
      }
    });
  });
}

const getTripDetail = async (gpsDeviceInfo) => {
  try {
    let cookResponse = {};
    if (gpsDeviceInfo && gpsDeviceInfo.imeiNO) {
      let currentGpDeviceData = await GpsDeviceLiveDataJsonDb.getData(
        '/' + gpsDeviceInfo.imeiNO
      );

      const ObjectId = require('mongodb').ObjectId;

      cookResponse.vendorId = gpsDeviceInfo && gpsDeviceInfo.Vehicle.vendorId;
      // cookResponse.corpId = gpsDeviceInfo && gpsDeviceInfo[0].corporateName;
      cookResponse.corpId = gpsDeviceInfo && gpsDeviceInfo.Vehicle.corporateId;

      cookResponse.mobileBatteryStatus = 0;
      cookResponse.GPS_SIGNAL_LOST = true;
      cookResponse.networkStrength = null;
      cookResponse.stopPointsDynamicETA = null;
      // cookResponse.OVER_SPEEDING= 0;
      cookResponse.OVER_SPEEDING = currentGpDeviceData.speed;
      cookResponse.gpsDeviceImei = gpsDeviceInfo.imeiNO || '';
      cookResponse.panicAlert = currentGpDeviceData.alertMap.PANIC || 0;

      var dateUTC = new Date();

      // dateUTC.setHours(dateUTC.getHours() + 5);
      // dateUTC.setMinutes(dateUTC.getMinutes() + 30);

      const day = String(dateUTC.getDate()).padStart(2, '0');
      const month = String(dateUTC.getMonth() + 1).padStart(2, '0');
      const year = dateUTC.getFullYear();
      // const currentTimeStamp = dateUTC.getTime();
      const formattedDate = `${day}-${month}-${year}`;
      cookResponse.updatedOn = currentGpDeviceData.localTimeStamp;
      cookResponse.dataPacketId = currentGpDeviceData.localTimeStamp;
      cookResponse.date = formattedDate;
      cookResponse.location = {
        lat: currentGpDeviceData.latitude,
        lng: currentGpDeviceData.longitude,
        heading: currentGpDeviceData.bearing,
        battery: '0',
      };
      cookResponse.tripStatus = gpsDeviceInfo.tripStatus;
      cookResponse.vehicleId = gpsDeviceInfo.vehicleId;
      cookResponse.driverId = gpsDeviceInfo.driverId;
      cookResponse.tripId = gpsDeviceInfo.tripId;
      cookResponse.gpsTrackingMode = gpsDeviceInfo.gpsTrackingMode;

      console.log(
        cookResponse,
        'New Data Nero Cooked Response+++++++++++++++++++++++++'
      );
    }

    return { cookedData: cookResponse, tripInfo: gpsDeviceInfo };
  } catch (error) {}
};

const sendSpeedAlert = async (tripDetail) => {
  let speed = tripDetail.OVER_SPEEDING;
  const path = '/' + tripDetail.corpId;
  let coporateSetting;
  try {
    const dataExists = await corporateSettingJsonDb.exists(path);
    if (dataExists) {
      coporateSetting = await corporateSettingJsonDb.getData(path);
    } else {
      const DriverSetting = database.collection('DriverSetting');
      const paramForQuery = { corporateId: tripDetail.corpId };
      const StartedTripInfo = await DriverSetting.findOne(paramForQuery);
      coporateSetting = StartedTripInfo;
      await corporateSettingJsonDb.push(path, StartedTripInfo);
    }
  } catch (error) {
    // The error will tell you where the DataPath stopped. In this case test1
    // Since /test1/test does't exist.
    const DriverSetting = database.collection('DriverSetting');
    const paramForQuery = { corporateId: tripDetail.corpId };
    const StartedTripInfo = await DriverSetting.findOne(paramForQuery);
    coporateSetting = StartedTripInfo;
    await corporateSettingJsonDb.push(path, StartedTripInfo);
  }

  console.log('SPEED---', speed, coporateSetting.alertDriverForSpeedLimit);
  const currentTime = new Date().getTime();
  // if (overSpeedingTrips.length > 0) {
  if (speed > coporateSetting.alertDriverForSpeedLimit) {
    const exists = overSpeedingTrips.filter(
      (someObj) => someObj.tripId == tripDetail.tripId
    );
    if (exists && exists.length > 0) {
      const differenceInMilliseconds = Math.abs(
        currentTime - exists[0].notificationSendOn
      );
      const differenceInSeconds = Math.round(differenceInMilliseconds / 1000);
      console.log(
        'Speed ALert+++++++++++++',
        differenceInSeconds,
        sendOverSpeedNotificationAfter
      );
      if (differenceInSeconds > sendOverSpeedNotificationAfter) {
        const axios = require('axios');
        const driverId = tripDetail && tripDetail.driverId;
        //ToDos Call Notification APIs.
        const url =
          process.env.APP_DOMAIN +
          '/user-reg/public/speed-limit-crossed/OverSpeed/' +
          driverId;
        const headers = {
          'Content-Type': 'application/json',
        };
        axios.get(`${url}`, '', {
          headers: headers,
        });

        for (const obj of overSpeedingTrips) {
          if (obj.tripId == exists[0].tripId) {
            obj.notificationSendOn = currentTime;
          }
        }
      }
    } else {
      overSpeedingTrips.push({
        tripId: tripDetail.tripId,
        notificationSendOn: currentTime,
      });
      const axios = require('axios');
      const driverId = tripDetail && tripDetail.driverId;
      //ToDos Call Notification APIs.
      const url =
        process.env.APP_DOMAIN +
        '/user-reg/public/speed-limit-crossed/OverSpeed/' +
        driverId;
      const headers = {
        'Content-Type': 'application/json',
      };
      axios.get(`${url}`, '', {
        headers: headers,
      });
    }
  }
  // } else {
  //   overSpeedingTrips.push({ tripId: tripDetail.tripId, notificationSendOn: currentTime })
  // }
};

const calculateStopPointsDynamicETA = async (currentLocation, tripInfo) => {
  // console.log(tripInfo, "Nero trip info in ETA")
  const stopList = tripInfo.stopList;
  // const axios = require('axios')
  const origin = `${currentLocation.lat}, ${currentLocation.lng}`;

  let getNextStop = null;
  for (let t = 0; t < stopList.length; t++) {
    if (['SCHEDULE', 'ARRIVED'].includes(stopList[t].status)) {
      getNextStop = stopList[t];

      break;
    }
  }
  const destination = `${getNextStop.location.latitude}, ${getNextStop.location.longitude}`;
  // const GOOGLE_MAP_APIKEY = process.env.GOOGLE_MAP_KEY;
  // Make a GET request
  // const response = await axios.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAP_APIKEY}`)
  const response = await callGoogleMapApi(origin, destination, '');
  const dynamicETAInSeconds =
    response.data?.routes[0]?.legs[0]?.duration?.value;
  let getDriverArrivalTimeToNextStop =
    addActualArrivalTimeInCurrentTime(dynamicETAInSeconds);
  let getDelayOrEarlyMin = getDelayOrEarlyMinutes(
    getNextStop?.expectedArivalTime,
    getDriverArrivalTimeToNextStop
  );

  sendDynamicETAToBackend(
    getNextStop?.id,
    getNextStop?.tripId,
    getDriverArrivalTimeToNextStop
  );
  return getDelayOrEarlyMin;
};

const callGoogleMapApi = async (origin, destination, wayPoints = '') => {
  const axios = require('axios');
  const GOOGLE_MAP_APIKEY = process.env.GOOGLE_MAP_KEY;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${wayPoints}&key=${GOOGLE_MAP_APIKEY}`;
  const response = await axios.get(url);
  return response;
};

function addActualArrivalTimeInCurrentTime(dynamicETAInSeconds) {
  // const today = convertUTCtoISTtimeStamp();
  const today = new Date();
  let newTime = today.setSeconds(today.getSeconds() + dynamicETAInSeconds);
  return newTime;
}

function getDelayOrEarlyMinutes(expectedTime, arrivalTime) {
  let expected = expectedTime;
  let arrival = arrivalTime;
  let secDiff = Math.floor((arrival - expected) / 1000);
  let minutesDiff = Math.floor(secDiff / 60);

  return minutesDiff;
}

function convertUTCtoISTtimeStamp() {
  const utcDate = new Date();

  // Convert the UTC Date object to IST
  const istDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  return istDate;
}

const sendDynamicETAToBackend = (stopPointId, tripId, arrivalTime) => {
  let sendingData = {
    id: stopPointId,
    tripId: tripId,
    updatedArivalTime: arrivalTime,
  };

  // api url = /user-reg/trip-driver/update-stop-dynamic-eta

  const axios = require('axios');
  //ToDos Call Notification APIs.
  const url =
    process.env.APP_DOMAIN + '/user-reg/trip-driver/update-stop-dynamic-eta';
  const headers = {
    'Content-Type': 'application/json',
    Vtt_user_signature: process.env.API_TOKEN,
  };
  try {
    axios
      .post(`${url}`, sendingData, {
        headers: headers,
      })
      .then((res) => {
        //console.log(res, "Nero res from api")
      })
      .catch((err) => {
        console.log(err, 'Nero err from api');
      });
  } catch (error) {
    console.log(error, 'Nero error from api');
  }
};

const sendStopageAlert = async (runningsTripData) => {
  const currentDateObj = convertUTCtoISTtimeStamp();
  const currentTime = currentDateObj.getTime();

  const tripExist = stoppageAlertArray.find(
    (item) => item.tripId == runningsTripData.tripId
  );
  if (!tripExist) {
    stoppageAlertArray.push({
      location: runningsTripData.location,
      updatedOn: currentTime,
      tripId: runningsTripData.tripId,
    });
  }
  if (stoppageAlertArray.length > 0) {
    for (let t = 0; t < stoppageAlertArray.length; t++) {
      if (stoppageAlertArray[t].tripId == runningsTripData.tripId) {
        const distanceTravelled = calculateDistance(
          stoppageAlertArray[t].location.lat,
          stoppageAlertArray[t].location.lng,
          runningsTripData.location.lat,
          runningsTripData.location.lng
        );
        const travelledTimeInMilliSec = Math.abs(
          currentTime - stoppageAlertArray[t].updatedOn
        );

        const differenceInSeconds = Math.round(travelledTimeInMilliSec / 1000);
        console.log(
          differenceInSeconds,
          distanceTravelled,
          stoppageAlertArray[t].tripId,
          runningsTripData.tripId,
          'Stoppage Alert ++++++++++++++++++++++++++++++'
        );
        if (differenceInSeconds > 60 && distanceTravelled < 100) {
          // for (const obj of stoppageAlertArray) {

          //   if (obj.tripId == runningsTripData.tripId) {
          //     obj.updatedOn = currentTime;
          //   }

          // }
          stoppageAlertArray[t].updatedOn = currentTime;
          console.log(
            'Sent Notification of Stoppage Alert +++++++++++++++++++++++++++++'
          );
          //ToDo call send notification API
          const axios = require('axios');
          const driverId = runningsTripData.driverId;
          //ToDos Call Notification APIs.
          const url =
            process.env.APP_DOMAIN +
            '/user-reg/public/speed-limit-crossed/Driver Wait/' +
            driverId;
          const headers = {
            'Content-Type': 'application/json',
          };
          axios.get(`${url}`, '', {
            headers: headers,
          });
        }
        // else{
        //   for (const obj of stoppageAlertArray) {

        //     if (obj.tripId == runningsTripData.tripId) {
        //       obj.updatedOn = currentTime;
        //     }

        //   }
        // }
      }
    }
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180; // Convert degrees to radians
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance * 1000; // Distance in Meter
}

const sendRouteDeviationAlert = async (currentTripData, tripDetail) => {
  const stopList = tripDetail && tripDetail.stopList;
  const tripId = currentTripData.tripId;
  const path = `/TripDirections/${tripId}`;
  try {
    const coveredRoutePath = `/CoveredRoute/${tripId}`;

    try {
      const data = await coveredRouteCordsDb.getData(coveredRoutePath);
      if (data && data.length > 0) {
        const currentLatLon = {
          latitude: currentTripData.location.lat,
          longitude: currentTripData.location.lng,
        };
        data.push(currentLatLon);
        await coveredRouteCordsDb.push(coveredRoutePath, data);
      }
    } catch (error) {
      const currentCords = [
        {
          latitude: currentTripData.location.lat,
          longitude: currentTripData.location.lng,
        },
      ];
      await coveredRouteCordsDb.push(coveredRoutePath, currentCords);
      console.log(error, 'DB ERROR');
    }

    const routeDirectionInfo = await routeDeviationDb.getData(path);
    const routeDirectionCords =
      routeDirectionInfo && routeDirectionInfo.start_to_end;
    const transforedArray =
      routeDirectionCords &&
      routeDirectionCords.map((obj) => {
        return [obj.latitude, obj.longitude];
      });

    const currentLocation = [
      currentTripData.location.lat,
      currentTripData.location.lng,
    ];
    const distanceInMeter = turf.pointToLineDistance(
      currentLocation,
      transforedArray,
      { units: 'meters' }
    );
    console.log(distanceInMeter, 'Route deviated distance in Meter');
    if (distanceInMeter > 70) {
      const allScheduledStops = stopList.filter(
        (item) => item.status == 'SCHEDULE'
      );
      const destinationStop = allScheduledStops.pop();
      const destinationStopString = `${destinationStop.location.latitude}, ${destinationStop.location.longitude}`;
      const wayPoints =
        allScheduledStops &&
        allScheduledStops.map((obj) => [
          obj.location.latitude,
          obj.location.longitude,
        ]);
      const response = await callGoogleMapApi(
        currentLocation.join(','),
        destinationStopString,
        wayPoints.join('|')
      );
      const newRouteCoordinates = decodePolyLinePoints(
        response.data?.routes[0].overview_polyline.points
      );
      // const coveredStops = stopList.filter(item => item.status == "DEPARTURED");
      // const coveredStopsForDB = coveredStops && coveredStops.map(obj => { return { latitude: obj.location.latitude, longitude: obj.location.longitude } })
      const coveredStopsForDB = await coveredRouteCordsDb.getData(
        coveredRoutePath
      );
      const parsedNewRouteCoordinates = newRouteCoordinates.map(
        (innerArray) => {
          return {
            // Assuming each inner array has three elements
            latitude: innerArray.latitude,
            longitude: innerArray.longitude,
          };
        }
      );

      const fullNewRouteCords = [
        ...coveredStopsForDB,
        ...parsedNewRouteCoordinates,
      ];
      routeDirectionInfo.currloc_to_end = parsedNewRouteCoordinates;
      routeDirectionInfo.start_to_end = fullNewRouteCords;
      await routeDeviationDb.push(path, routeDirectionInfo);
      const tripDirections = database.collection('TripDirections');
      const query = { tripId: tripId };
      const update = { $set: routeDirectionInfo };
      const options = { upsert: true };
      await tripDirections.updateOne(query, update, options);

      const axios = require('axios');
      const driverId = tripDetail && tripDetail.driverId;
      //ToDos Call Notification APIs.
      const url =
        process.env.APP_DOMAIN +
        '/user-reg/public/speed-limit-crossed/Route Deviation/' +
        driverId;
      const headers = {
        'Content-Type': 'application/json',
      };
      axios.get(`${url}`, '', {
        headers: headers,
      });
    }
  } catch (error) {}
};

const decodePolyLinePoints = (t, e) => {
  for (
    var n,
      o,
      u = 0,
      l = 0,
      r = 0,
      d = [],
      h = 0,
      i = 0,
      a = null,
      c = Math.pow(10, e || 5);
    u < t.length;

  ) {
    (a = null), (h = 0), (i = 0);
    do (a = t.charCodeAt(u++) - 63), (i |= (31 & a) << h), (h += 5);
    while (a >= 32);
    (n = 1 & i ? ~(i >> 1) : i >> 1), (h = i = 0);
    do (a = t.charCodeAt(u++) - 63), (i |= (31 & a) << h), (h += 5);
    while (a >= 32);
    (o = 1 & i ? ~(i >> 1) : i >> 1),
      (l += n),
      (r += o),
      d.push([l / c, r / c]);
  }
  return (d = d.map(function (t) {
    return { latitude: t[0], longitude: t[1] };
  }));
};

const getTripEmployees = async (tripDetail) => {
  const ObjectId = require('mongodb').ObjectId;

  let odPsngers;
  if (tripDetail && tripDetail.tripType == 'UPTRIP') {
    //const onBoardpsngers = tripDetail.stopList.filter(sl=>Object.keys(sl).includes('deBoardPassengers'))
    odPsngers =
      tripDetail.stopList[tripDetail.stopList.length - 1].deBoardPassengers;
  }

  if (tripDetail && tripDetail.tripType == 'DOWNTRIP') {
    // const deBoardpsngers =  tripDetail.stopList.filter(sl=>Object.keys(sl).includes('onBoardPassengers'))
    odPsngers = tripDetail.stopList[0].onBoardPassengers;
  }

  let psngerIdsArray = [];
  for (let t = 0; t < odPsngers.length; t++) {
    psngerIdsArray.push(ObjectId(odPsngers[t].oid));
  }

  const tc = database.collection('RoutePassenger');
  const emps = await tc.find({ _id: { $in: psngerIdsArray } }).toArray();
  let empIds = emps
    .filter((e) => ['SCHEDULE', 'BOARDED'].includes(e.status))
    .filter((f) => f.passType != 'ESCORT')
    .map((m) => {
      return m.empId;
    });

  empIds.push(tripDetail.corporateId);
  empIds.push(tripDetail.vendorId);

  let getNextStop = null;
  for (let t = 0; t < tripDetail.stopList.length; t++) {
    if (['SCHEDULE', 'ARRIVED'].includes(tripDetail.stopList[t].status)) {
      getNextStop = tripDetail.stopList[t];

      break;
    }
  }

  return { empIds: empIds, stopPoint: getNextStop };
};

const getMappedStartedTripWithDeviceId = async (deviceData) => {
  try {
    const gpsDevices = database.collection('GpsDevices');
    // const deviceImeiNo = "864356061191246";
    const deviceImeiNo = deviceData.deviceImei;
    const vehicleInfo = await gpsDevices
      .find({ imeiNO: deviceImeiNo })
      .toArray();
    if (vehicleInfo && vehicleInfo.length > 0) {
      const currentDate = new Date();
      const day = String(currentDate.getDate()).padStart(2, '0');
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const year = currentDate.getFullYear();
      // const currentTimeStamp = dateUTC.getTime();
      const formattedDate = `${year}-${month}-${day}`;
      //const formattedDate = "2024-04-01"
      const TripRouteDto = database.collection('TripRouteDto');
      const tripDetails = await TripRouteDto.find({
        vehicleNo: vehicleInfo[0].vehicleNumberPlate,
        date: formattedDate,
        status: 'STARTED',
      }).toArray();
      if (tripDetails && tripDetails.length > 0) {
        return tripDetails[0];
      } else {
        return {};
      }
    }
  } catch (error) {
    console.log(error, 'Error++++++++++++++++++');
  }
};

//This function will be triggered if any passenger press the PANIC button installed in the cab.
const sendPanicAlert = async (deviceData, socket, io) => {
  let tripDetail = await getMappedStartedTripWithDeviceId(deviceData);
  if (tripDetail && Object.keys(tripDetail).length > 0) {
    const sendUserSocket = onlineUsers.get(tripDetail.corporateId);
    const sosData = {
      tripId: tripDetail._id.toString(),
      latitude: deviceData.latitude.toString(),
      longitude: deviceData.longitude.toString(),
      time: new Date().getTime(),
    };
    const axios = require('axios');
    //ToDos Call Notification APIs.
    const url =
      process.env.APP_DOMAIN + '/user-reg/public/update-sso-details-driver';
    const headers = {
      'Content-Type': 'application/json',
    };
    try {
      axios.post(`${url}`, sosData, {
        headers: headers,
      });

      // if (sendUserSocket) {
      sosData.driverId = tripDetail.driverId;
      // socket.to(tripDetail.corporateId).emit("sos-trigger", sosData);
      io.to(tripDetail.corporateId).emit('sos-trigger', sosData);
      // }
    } catch (error) {
      console.log('ERROR IN SENDING PANIC ALERT API:', error);
    }
  }
};
