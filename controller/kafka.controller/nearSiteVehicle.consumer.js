const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const haversine = require('haversine-distance');
const brokerurl = process.env.KAFKA_BROKER;
const RADIUS = 2020;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerurl],
});

const consumer = kafka.consumer({ groupId: 'vehicle-near-site' });

let vehicleNearSiteCount = 0;
let vehicleGPSData = [];
let activeSockets = [];

const vehicleNearSiteSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/vehicle/near/site/consumer',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  await consumer
    .connect()
    .then(() => {
      console.log(`connected to vehicle near site topic`);
    })
    .catch((error) => {
      console.log(`error captured at adhoc topic: ${error}`);
    });

  await consumer
    .subscribe({ topic: 'driver-location', fromBeginning: false })
    .then(() => {
      console.log(`subscribed to driver-location topic`);
    })
    .catch((error) => {
      console.log(`error subscribing to topic: ${error}`);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log('Vehicle near site consumer connected');
    activeSockets.push(socket);

    const corporateIdFromQuery = socket.handshake.query.corporateId;
    const latitude = parseFloat(socket.handshake.query.latitude);
    const longitude = parseFloat(socket.handshake.query.longitude);

    if (!corporateIdFromQuery) {
      socket.emit('near-site-vehicle-error', 'Corporate ID is required');
      return;
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      socket.emit(
        'near-site-vehicle-error',
        'Latitude and longitude must be valid numbers'
      );
      return;
    }

    const siteLocation = {
      lat: latitude,
      lng: longitude,
    };

    const sendVehicleNearOffice = () => {
      activeSockets.forEach((sock) => {
        sock.emit('adhoc-trip-update', {
          count: vehicleNearSiteCount,
          vehicles: vehicleGPSData,
        });
      });
    };

    try {
      await consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const vehicleGpsResult = JSON.parse(message.value.toString());
              const { driverData, tripData, isActive, latitude, longitude } =
                vehicleGpsResult;

              const vehicleCorporateId = driverData.corporateId;
              const tripCorporateId = tripData.corporateId;

              if (
                vehicleCorporateId !== corporateIdFromQuery &&
                tripCorporateId !== corporateIdFromQuery
              ) {
                return;
              }

              const vehicleLocation = {
                lat: parseFloat(latitude),
                lng: parseFloat(longitude),
              };

              const distance = haversine(siteLocation, vehicleLocation);
              const isWithinRadius = distance <= RADIUS;

              const existingVehicleIndex = vehicleGPSData.findIndex(
                (vehicle) =>
                  vehicle.driverData.vehicleId === driverData.vehicleId
              );

              if (isActive && isWithinRadius) {
                if (existingVehicleIndex === -1) {
                  vehicleGPSData.push(vehicleGpsResult);
                  vehicleNearSiteCount++;
                } else {
                  vehicleGPSData[existingVehicleIndex] = vehicleGpsResult;
                }
              } else {
                if (existingVehicleIndex !== -1) {
                  vehicleGPSData.splice(existingVehicleIndex, 1);
                  vehicleNearSiteCount = Math.max(vehicleNearSiteCount - 1, 0);
                }
              }

              vehicleNearSiteCount = Math.max(vehicleNearSiteCount, 0);

              sendVehicleNearOffice();
            } catch (error) {
              console.error(`Error processing message: ${error.message}`);
              socket.emit('near-site-vehicle-error', error.message);
            }
          },
        })
        .then(() => {
          console.log(`Vehicle near office consumer running`);
        })
        .catch((error) => {
          console.error(`Error: ${error.message}`);
        });
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
      socket.emit('near-site-vehicle-error', error.message);
    }

    socket.on('disconnect', () => {
      console.log('Near site vehicle disconnected');
    });

    consumer.on('consumer.crash', async (e) => {
      console.error('Consumer crashed, attempting to reconnect...', e);
      try {
        await consumer.disconnect();
        await consumer.connect();
        await consumer.subscribe({
          topic: 'driver-location',
          fromBeginning: false,
        });
        console.log('Consumer reconnected');
      } catch (error) {
        console.error('Error reconnecting the consumer:', error.message);
        socket.emit(
          'near-site-vehicle-error',
          'Failed to reconnect Kafka consumer'
        );
      }
    });
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await consumer.disconnect();
    process.exit(0);
  });
};

module.exports = {
  vehicleNearSiteSocket,
};
