const { Server } = require('socket.io');
const { Kafka } = require('kafkajs');
const axios = require('axios');
const brokerurl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerurl],
});

const consumer = kafka.consumer({ groupId: 'expected-frist-delay' });

let vehicleDelayCount = 0;
let vehicleGPSData = [];
let activeSockets = [];

const getEstimatedTime = async (origin, destination) => {
  const { lat: originLat, lng: originLng } = origin;
  const { lat: destLat, lng: destLng } = destination;

  const apiKey = process.env.GOOGLE_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const data = response.data.rows[0].elements[0];

    if (data.status === 'OK') {
      return data.duration.value;
    } else {
      throw new Error('Failed to calculate estimated time');
    }
  } catch (error) {
    console.error('Error fetching estimated time:', error.message);
    return null;
  }
};

const expectedFirstPickUpDelaySocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/expected/first/pickup/delay/consumer',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  await consumer.connect();
  await consumer.subscribe({ topic: 'driver-location', fromBeginning: false });

  kafkaConsumer.on('connection', async (socket) => {
    console.log('Expected first pick-up delay consumer connected');
    activeSockets.push(socket);

    const corporateId = socket.handshake.query.corporateId;
    const employeeLatitude = parseFloat(socket.handshake.query.latitude);
    const employeeLongitude = parseFloat(socket.handshake.query.longitude);
    const tripId = socket.handshake.query.tripId;

    const employeeLocation = { lat: employeeLatitude, lng: employeeLongitude };

    let expectedArrivalTime = null;
    let tripStartTime = null;

    const sendVehicleDelayUpdate = () => {
      activeSockets.forEach((sock) => {
        sock.emit('expected-first-pick-up-trip-update', {
          delayCount: vehicleDelayCount,
          vehicles: vehicleGPSData,
        });
      });
    };

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const vehicleGpsResult = JSON.parse(message.value.toString());
          const {
            driverData,
            tripData,
            latitude,
            longitude,
            isActive,
            timeStamp,
          } = vehicleGpsResult;

          if (tripData.corporateId !== corporateId) return;

          const vehicleLocation = {
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
          };
          const currentTime = new Date(timeStamp).getTime();

          if (!tripStartTime) tripStartTime = currentTime;

          if (!expectedArrivalTime) {
            const estimatedTime = await getEstimatedTime(
              vehicleLocation,
              employeeLocation
            );
            if (estimatedTime) {
              expectedArrivalTime = tripStartTime + estimatedTime * 1000;
              console.log(
                `Expected arrival time for trip ${tripId}:`,
                new Date(expectedArrivalTime)
              );
            }
          }

          const now = Date.now();

          if (now > expectedArrivalTime && isActive) {
            vehicleDelayCount = Math.max(vehicleDelayCount + 1, 0);
          }

          const existingVehicleIndex = vehicleGPSData.findIndex(
            (vehicle) => vehicle.tripId === tripId
          );

          if (isActive) {
            if (existingVehicleIndex === -1) {
              vehicleGPSData.push(vehicleGpsResult);
            } else {
              vehicleGPSData[existingVehicleIndex] = vehicleGpsResult;
            }
          } else {
            if (existingVehicleIndex !== -1) {
              vehicleGPSData.splice(existingVehicleIndex, 1);
              vehicleDelayCount = Math.max(vehicleDelayCount - 1, 0);
            }
          }

          sendVehicleDelayUpdate();
        } catch (error) {
          console.error(`Error processing message: ${error.message}`);
          socket.emit('expected-first-pick-up-error', error.message);
        }
      },
    });

    socket.on('disconnect', () => {
      console.log(`Socket ${socket.id} disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);

      if (activeSockets.length === 0) {
        console.log(
          'No active connections. Kafka consumer could be stopped if needed.'
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
  expectedFirstPickUpDelaySocket,
};
