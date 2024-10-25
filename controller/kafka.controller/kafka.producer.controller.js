const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const brokerurl = process.env.KAFKA_BROKER;
const moment = require('moment');
const detailsFetcher = require('../../middlewares/kafka.middlewares');

const kafka = new Kafka({
  clientId: 'producer-api',
  brokers: [brokerurl],
  connectionTimeout: 3000,
  retry: {
    retries: 5,
  },
});

const producer = kafka.producer();

const tripStatus = {};
const sosRasied = {};
const sentData = {};

const kafkaProducerSocket = async (server) => {
  const kafkaProd = new Server(server, {
    path: '/api/kafkaProducer',
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  kafkaProd.on('connection', (socket) => {
    console.log('Kafka producer connected');

    socket.on('start-trip-driver', async (data) => {
      try {
        if (!data || data === undefined) {
          socket.emit('start-error-status', `No data found`);
          return;
        }

        const objectData = data;
        const driverId = objectData.driverId;
        const vehicleId = objectData.vehicleId;
        const tripId = objectData.tripId;
        const driverVehicleCollection = 'vehicleDriverMappingDto';
        const tripCollection = 'TripRouteDto';

        const driverData = await detailsFetcher.fetchDriverdetails(
          driverVehicleCollection,
          driverId,
          vehicleId
        );
        const tripData = await detailsFetcher.fetchTripPassengers(
          tripCollection,
          tripId
        );

        if (!driverData || driverData.length === 0) {
          socket.emit(
            'start-error-status',
            `No data found for driver ID ${driverId}`
          );
          return;
        }

        if (!tripData || tripData.length === 0) {
          socket.emit(
            'start-error-status',
            `No data found for tripCode ${tripId}`
          );
          return;
        }

        if (tripStatus[driverId]?.isActive) {
          socket.emit('start-error-status', {
            message: `Trip already started for driver ID ${driverId}`,
            data: sentData[driverId] || '', // Send the previously stored data
          });
          return;
        }

        // If trip has not started, proceed with the new data
        tripStatus[driverId] = { isActive: true };

        const statusData = {
          driverData: driverData[0],
          tripData: tripData[0],
          isActive: tripStatus[driverId].isActive,
          latitude: objectData.latitude,
          longitude: objectData.longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        // Store the data in sentData for later retrieval
        sentData[driverId] = statusData;

        await producer.send({
          topic: 'driver-live-status',
          messages: [{ value: JSON.stringify(statusData) }],
        });

        socket.emit('driver-start-status', statusData);
      } catch (error) {
        console.log(error);
        socket.emit('start-error-status', error);
      }
    });

    socket.on('stop-trip-driver', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('stop-error-status', `No data found`);
        }
        const objectData = data;
        const driverId = objectData.driverId;

        if (!tripStatus[driverId]?.isActive) {
          socket.emit('stop-error-status', `trip has been aready stopped`);
          return;
        }
        tripStatus[driverId] = { isActive: false };

        const vehicleId = objectData.vehicleId;
        const tripId = objectData.tripId;

        const driverVehicleCollection = 'vehicleDriverMappingDto';
        const tripCollection = 'TripRouteDto';

        const driverData = await detailsFetcher.fetchDriverdetails(
          driverVehicleCollection,
          driverId,
          vehicleId
        );
        const tripData = await detailsFetcher.fetchTripPassengers(
          tripCollection,
          tripId
        );

        const statusData = {
          driverData: driverData[0],
          tripData: tripData[0],
          isActive: tripStatus[driverId].isActive,
          latitude: objectData.latitude,
          longitude: objectData.longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        if (statusData.tripData.tripMates == 'pink') {
          await producer.send({
            topic: 'female-trip',
            messages: [{ value: JSON.stringify(statusData) }],
          });
        }

        if (statusData.tripData.tripMates == 'blue') {
          await producer.send({
            topic: 'escort-trip',
            messages: [{ value: JSON.stringify(statusData) }],
          });
        }

        if (tripData[0].tripCategory == 'ADHOCTRIP') {
          await producer.send({
            topic: 'adhoc-trip',
            messages: [{ value: JSON.stringify(statusData) }],
          });
        }

        await producer.send({
          topic: 'driver-location',
          messages: [{ value: JSON.stringify(statusData) }],
        });

        await producer.send({
          topic: 'driver-live-status',
          messages: [{ value: JSON.stringify(statusData) }],
        });

        socket.emit('driver-stop-status', statusData);
      } catch (error) {
        console.log(error);
        socket.emit('stop-error-status', error);
      }
    });

    socket.on('start-trip-employee', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('stop-error-status', `No data found`);
          return;
        }
        const objectData = data;
        const employeeId = objectData.employeeId;
        const tripId = objectData.tripId;
        const vehicleId = objectData.vehicleId;
        const latitude = objectData.latitude;
        const longitude = objectData.longitude;
        const employeeCollection = 'EmployeeReg';
        const vehicleCollection = 'VehicleReg';
        const tripCollection = 'TripRouteDto';
        const employeeData = await detailsFetcher.fetchEmployeeDetails(
          employeeCollection,
          vehicleCollection,
          tripCollection,
          employeeId,
          vehicleId,
          tripId
        );

        if (!employeeData || employeeData.length === 0) {
          socket.emit(
            'start-error-status',
            `No data found for driver ID ${employeeId}`
          );
          return;
        }

        tripStatus[employeeId] = { isActive: true };

        await producer.send({
          topic: 'employee-pickup-status',
          messages: [{ value: JSON.stringify(employeeStatus) }],
        });

        socket.emit('employee-start-status', employeeStatus);
      } catch (error) {
        console.log(error);
        socket.emit('employee-start-status', error);
      }
    });

    socket.on('stop-trip-employee', async (data) => {
      try {
        const objectData = data;
        const employeeId = objectData.employeeId;

        if (!tripStatus[employeeId]?.isActive) {
          socket.emit('stop-error-status', `employee trip already stopped`);
          return;
        }
        tripStatus[employeeId] = { isActive: false };
        const tripId = objectData.tripId;
        const vehicleId = objectData.vehicleId;
        const employeeCollection = 'EmployeeReg';
        const vehicleCollection = 'VehicleReg';
        const tripCollection = 'TripRouteDto';

        const employeeData = await detailsFetcher.fetchEmployeeDetails(
          employeeCollection,
          vehicleCollection,
          tripCollection,
          employeeId,
          vehicleId,
          tripId
        );

        const employeeStatus = {
          employeeDetails: employeeData.employeeDetails[0],
          vehicleDetails: employeeData.vehicleDetails[0],
          tripDetails: employeeData.tripDetails[0],
          isActive: tripStatus[employeeId].isActive,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        const empETAData = await detailsFetcher.getFirstEmployeeData(
          tripCollection,
          tripId
        );
        console.log(`empETAData:`, empETAData[0]);

        if (
          empETAData[0]._id == employeeStatus.employeeDetails._id &&
          employeeStatus.timeStamp > empETAData[0].expectedArivalTime
        ) {
          await producer.send({
            topic: 'first-pickup-delay',
            messages: [{ value: JSON.stringify(employeeStatus) }],
          });
        }

        await producer.send({
          topic: 'employee-pickup-status',
          messages: [{ value: JSON.stringify(employeeStatus) }],
        });

        if (employeeData.employeeDetails[0].specificNeedType == 'Yes') {
          await producer.send({
            topic: 'special-employee-trip',
            messages: [{ value: JSON.stringify(employeeStatus) }],
          });
        }

        socket.emit('employee-stop-status', employeeStatus);
      } catch (error) {
        console.log(error);
        socket.emit('employee-stop-status', error);
      }
    });

    socket.on('sos-driver', async (data) => {
      try {
        if (!data) {
          socket.emit('sos-error', 'Data is undefined');
          return;
        }

        const { driverId, tripId, vehicleId, latitude, longitude } = data;

        if (!tripStatus[driverId]?.isActive) {
          socket.emit(
            'sos-error',
            `Cannot raise SOS. The trip is not active for driver ID ${driverId}`
          );
          return;
        }

        const driverVehicleCollection = 'vehicleDriverMappingDto';
        const tripCollection = 'TripRouteDto';

        const driverData = await detailsFetcher.fetchDriverdetails(
          driverVehicleCollection,
          driverId,
          vehicleId
        );

        const tripData = await detailsFetcher.fetchTripPassengers(
          tripCollection,
          tripId
        );

        if (!driverData || driverData.length === 0) {
          socket.emit('sos-error', `No data found for driver ID ${driverId}`);
          return;
        }

        if (!tripData || tripData.length === 0) {
          socket.emit('sos-error', `No data found for trip ID ${tripId}`);
          return;
        }

        sosRasied[driverId] = { isActive: true };

        const sosData = {
          driverId,
          driverData: driverData[0],
          tripData: tripData[0],
          sosRaised: sosRasied[driverId].isActive,
          latitude: latitude,
          longitude: longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        await producer.send({
          topic: 'sos-driver-alert',
          messages: [{ value: JSON.stringify(sosData) }],
        });

        socket.emit('sos-driver-started', sosData);
      } catch (error) {
        console.error(error);
        socket.emit('sos-error', error.message);
      }
    });

    socket.on('sos-driver-stop', async (data) => {
      try {
        if (!data) {
          socket.emit('sos-error', 'Data is undefined');
          return;
        }

        const { driverId, tripId, vehicleId } = data;

        if (!sosRasied[driverId] || !sosRasied[driverId].isActive) {
          socket.emit(
            'sos-error',
            `SOS is not active for Driver ID ${driverId}, cannot stop`
          );
          return;
        }

        const driverVehicleCollection = 'vehicleDriverMappingDto';
        const tripCollection = 'TripRouteDto';

        const driverData = await detailsFetcher.fetchDriverdetails(
          driverVehicleCollection,
          driverId,
          vehicleId
        );

        const tripData = await detailsFetcher.fetchTripPassengers(
          tripCollection,
          tripId
        );

        if (!driverData || driverData.length === 0) {
          socket.emit('sos-error', `No data found for driver ID ${driverId}`);
          return;
        }

        if (!tripData || tripData.length === 0) {
          socket.emit('sos-error', `No data found for trip ID ${tripId}`);
          return;
        }

        sosRasied[driverId] = { isActive: false };

        const sosData = {
          driverId,
          driverData: driverData[0],
          tripData: tripData[0],
          sosRaised: sosRasied[driverId].isActive,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        await producer.send({
          topic: 'sos-driver-alert',
          messages: [{ value: JSON.stringify(sosData) }],
        });

        socket.emit('sos-driver-stopped', sosData);
      } catch (error) {
        console.error(error);
        socket.emit('sos-error', error.message);
      }
    });

    socket.on('sos-employee', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('sos-error', `Data is undefined`);
        }
        const objectData = data;
        const employeeId = objectData.employeeId;
        if (!tripStatus[employeeId]?.isActive) {
          socket.emit(
            'sos-error',
            `Cannot raise SOS. The trip is not active for employee ID ${employeeId}`
          );
          return;
        }
        const tripId = objectData.tripId;
        const vehicleId = objectData.vehicleId;
        const employeeCollection = 'EmployeeReg';
        const vehicleCollection = 'VehicleReg';
        const tripCollection = 'TripRouteDto';
        const latitude = objectData.latitude;
        const longitude = objectData.longitude;
        const employeeData = await detailsFetcher.fetchEmployeeDetails(
          employeeCollection,
          vehicleCollection,
          tripCollection,
          employeeId,
          vehicleId,
          tripId
        );
        if (!employeeData || employeeData.length === 0) {
          socket.emit(
            'start-error-status',
            `No data found for driver ID ${employeeId}`
          );
          return;
        }

        sosRasied[employeeId] = { isActive: true };
        const sosData = {
          employeeId,
          employeeDetails: employeeData.employeeDetails[0],
          vehicleDetails: employeeData.vehicleDetails[0],
          tripDetails: employeeData.tripDetails[0],
          sosRaised: sosRasied[employeeId].isActive,
          latitude: latitude,
          longitude: longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        await producer.send({
          topic: 'sos-employee-alert',
          messages: [{ value: JSON.stringify(sosData) }],
        });

        socket.emit('sos-employee-started', sosData);
      } catch (error) {
        console.log(error);
        socket.emit('sos-error', error);
      }
    });

    socket.on('sos-employee-stop', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('sos-error', `Data is undefined`);
          return;
        }

        const objectData = data;
        const employeeId = objectData.employeeId;
        const tripId = objectData.tripId;
        const vehicleId = objectData.vehicleId;
        const latitude = objectData.latitude;
        const longitude = objectData.longitude;
        const employeeCollection = 'EmployeeReg';
        const vehicleCollection = 'VehicleReg';
        const tripCollection = 'TripRouteDto';

        if (!sosRasied[employeeId] || !sosRasied[employeeId].isActive) {
          socket.emit(
            'sos-error',
            `SOS is not active for employee ID ${employeeId}, cannot stop`
          );
          return;
        }

        const employeeData = await detailsFetcher.fetchEmployeeDetails(
          employeeCollection,
          vehicleCollection,
          tripCollection,
          employeeId,
          vehicleId,
          tripId
        );

        if (!employeeData || employeeData.length === 0) {
          socket.emit(
            'stop-error-status',
            `No data found for employee ID ${employeeId}`
          );
          return;
        }

        sosRasied[employeeId] = { isActive: false };

        const sosData = {
          employeeId,
          employeeDetails: employeeData.employeeDetails[0],
          vehicleDetails: employeeData.vehicleDetails[0],
          tripDetails: employeeData.tripDetails[0],
          sosRaised: sosRasied[employeeId].isActive,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        await producer.send({
          topic: 'sos-employee-alert',
          messages: [{ value: JSON.stringify(sosData) }],
        });

        socket.emit('sos-emplyee-stopped', sosData);
      } catch (error) {
        console.log(error);
        socket.emit('sos-error', error.message);
      }
    });

    socket.on('gps-data-employee', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('gps-data-employee-error', `No data found`);
        }
        const objectData = data;
        const employeeId = objectData.employeeId;
        const tripId = objectData.tripId;
        const vehicleId = objectData.vehicleId;
        const latitude = objectData.latitude;
        const longitude = objectData.longitude;
        const employeeCollection = 'EmployeeReg';
        const vehicleCollection = 'VehicleReg';
        const tripCollection = 'TripRouteDto';
        const employeeData = await detailsFetcher.fetchEmployeeDetails(
          employeeCollection,
          vehicleCollection,
          tripCollection,
          employeeId,
          vehicleId,
          tripId
        );

        if (!employeeData || employeeData.length === 0) {
          socket.emit(
            'start-error-status',
            `No data found for driver ID ${employeeId}`
          );
          return;
        }
        if (!tripStatus[employeeId]?.isActive) {
          socket.emit(
            'gps-data-employee',
            `Trip is inactive for ${employeeId}. Ignoring GPS data`
          );
          return;
        }

        const empETAData = await detailsFetcher.getFirstEmployeeData(
          tripCollection,
          tripId
        );
        console.log(`empETAData:`, empETAData[0]);

        const employeeStatus = {
          employeeDetails: employeeData.employeeDetails[0],
          vehicleDetails: employeeData.vehicleDetails[0],
          tripDetails: employeeData.tripDetails[0],
          isActive: tripStatus[employeeId].isActive,
          latitude: latitude,
          longitude: longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        if (
          empETAData[0]._id == employeeStatus.employeeDetails._id &&
          employeeStatus.timeStamp > empETAData[0].expectedArivalTime
        ) {
          await producer.send({
            topic: 'first-pickup-delay',
            messages: [{ value: JSON.stringify(employeeStatus) }],
          });
        }

        if (employeeData.employeeDetails[0].specificNeedType == 'Yes') {
          await producer.send({
            topic: 'special-employee-trip',
            messages: [{ value: JSON.stringify(employeeStatus) }],
          });
        }

        socket.emit('employee-gps-status', employeeStatus);
      } catch (error) {
        console.log(`Error: ${error}`);
        socket.emit('gps-error', error);
      }
    });

    socket.on('gps-data', async (data) => {
      try {
        if (!data || data == undefined) {
          socket.emit('gps-error', `No data found`);
        }
        const objectData = data;
        const driverId = objectData.driverId;

        if (!tripStatus[driverId]?.isActive) {
          socket.emit(
            'gps-data',
            `Trip is inactive for driver ${driverId}. Ignoring GPS data.`
          );
          return;
        }

        const vehicleId = objectData.vehicleId;
        const tripId = objectData.tripId;
        const driverVehicleCollection = 'vehicleDriverMappingDto';
        const tripCollection = 'TripRouteDto';

        const driverData = await detailsFetcher.fetchDriverdetails(
          driverVehicleCollection,
          driverId,
          vehicleId
        );

        const passengerData = await detailsFetcher.fetchTripPassengers(
          tripCollection,
          tripId
        );

        if (!passengerData || passengerData.length === 0) {
          socket.emit('gps-error', `No data found for tripCode ${tripId}`);
          return;
        }

        const processedData = {
          driverData: driverData[0],
          tripData: passengerData[0],
          isActive: tripStatus[driverId]?.isActive,
          latitude: objectData.latitude,
          longitude: objectData.longitude,
          timeStamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        };

        if (processedData.tripData.tripMates == 'pink') {
          await producer.send({
            topic: 'female-trip',
            messages: [{ value: JSON.stringify(processedData) }],
          });
        }

        if (processedData.tripData.tripMates == 'blue') {
          await producer.send({
            topic: 'escort-trip',
            messages: [{ value: JSON.stringify(processedData) }],
          });
        }

        if (processedData.tripData.tripCategory == 'ADHOCTRIP') {
          await producer.send({
            topic: 'adhoc-trip',
            messages: [{ value: JSON.stringify(processedData) }],
          });
        }

        await producer.send({
          topic: 'driver-location',
          messages: [{ value: JSON.stringify(processedData) }],
        });

        socket.emit('gps-data-record', processedData);
      } catch (error) {
        console.log(`Error: ${error}`);
        socket.emit('gps-error', error);
      }
    });

    try {
      socket.on('disconnect', () => {
        console.log(`Kafka producer disconnected`);
      });
    } catch (error) {
      console.log(`Error in socket:`, error);
    }
  });

  await producer.connect();
};

module.exports = {
  kafkaProducerSocket,
};
