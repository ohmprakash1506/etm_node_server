const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerUrl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerUrl],
  logLevel: 4,
  retry: {
    retries: 5,
  },
});

const consumer = kafka.consumer({ groupId: 'live-count-group' });
let liveVehicleCount = 0;
let liveData = [];
let activeSockets = [];

const liveTrackingCountSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/live/count/consumer',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  await consumer.connect();
  console.log(`Connected to Kafka`);

  await consumer.subscribe({ topic: 'driver-location', fromBeginning: false });
  console.log(`Subscribed to driver-location topic`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(
        `Received message from topic ${topic}: ${message.value.toString()}`
      );
      activeSockets.forEach((socket) => {
        processMessage(message, socket);
      });
    },
  });

  kafkaConsumer.on('connection', (socket) => {
    console.log('Live count consumer connected');
    activeSockets.push(socket);

    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('live-tracking-error', 'Corporate ID is required');
      return;
    }

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });
  });

  const processMessage = (message, socket) => {
    try {
      const vehicleStatus = JSON.parse(message.value.toString());
      const { driverData, tripData, isActive } = vehicleStatus;
      const vehicleCorporateId = driverData.corporateId;
      const tripCorporateId = tripData.corporateId;

      if (
        vehicleCorporateId !== socket.handshake.query.corporateId &&
        tripCorporateId !== socket.handshake.query.corporateId
      ) {
        return console.log(`Corporate ID mismatch. Ignoring message.`);
      }

      const vehicleId = driverData.vehicleId;
      const existingVehicleIndex = liveData.findIndex(
        (data) => data.driverData.vehicleId === vehicleId
      );

      if (isActive) {
        if (existingVehicleIndex === -1) {
          liveData.push(vehicleStatus);
          liveVehicleCount++;
        } else {
          liveData[existingVehicleIndex] = vehicleStatus;
        }
      } else {
        if (existingVehicleIndex !== -1) {
          liveData.splice(existingVehicleIndex, 1);
          liveVehicleCount--;
        }
      }

      liveVehicleCount = Math.max(liveVehicleCount, 0);

      const filteredVehicles = liveData.filter((data) => {
        return (
          data.driverData.corporateId === socket.handshake.query.corporateId ||
          data.tripData.corporateId === socket.handshake.query.corporateId
        );
      });

      socket.emit('live-vehicle-count', {
        count: filteredVehicles.length,
        vehicles: filteredVehicles,
      });
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
      socket.emit('vehicle-status-error', error.message);
    }
  };

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await consumer.disconnect();
    activeSockets.forEach((socket) => socket.disconnect(true));
    process.exit(0);
  });
};

module.exports = {
  liveTrackingCountSocket,
};
