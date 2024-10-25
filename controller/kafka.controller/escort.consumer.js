const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerurl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerurl],
  retry: {
    retries: 5,
  },
});

const consumer = kafka.consumer({ groupId: 'escort-trip-group' });
let escortTripCount = 0;
let escortData = [];
let activeSockets = [];

const escortTripSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/escort/consumer',
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
      console.log(`connected to escort topic `);
    })
    .catch((error) => {
      console.log(`error captured at escort topic: ${error}`);
    });
  await consumer
    .subscribe({
      topic: 'escort-trip',
      fromBeginning: false,
    })
    .then(() => {
      console.log(`subscribed to escort topic`);
    })
    .catch((error) => {
      console.log(`error subscribing to topic: ${error}`);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log(`escort trip consumer connected`);
    activeSockets.push(socket);
    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('escort-trip-error', 'Corporate ID is required');
      return;
    }

    const sendAdhocCount = () => {
      activeSockets.forEach((sock) => {
        sock.emit('escort-trip-update', {
          count: escortTripCount,
          vehicles: escortData,
        });
      });
    };

    try {
      await consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const escortVehicleStatus = JSON.parse(message.value.toString());

              const { driverData, tripData, isActive } = escortVehicleStatus;
              const vehicleId = driverData.vehicleId;

              const existingVehicleIndex = escortData.findIndex(
                (data) => data.driverData.vehicleId === vehicleId
              );

              if (isActive) {
                if (existingVehicleIndex === -1) {
                  escortData.push(escortVehicleStatus);
                  escortTripCount++;
                } else {
                  escortData[existingVehicleIndex] = escortVehicleStatus;
                }
              } else {
                if (existingVehicleIndex !== -1) {
                  escortData.splice(existingVehicleIndex, 1);
                  escortTripCount--;
                }
              }

              escortTripCount = Math.max(escortTripCount, 0);

              sendAdhocCount();
            } catch (error) {
              console.error(`Error in kafak adhoc consumer: ${error}`);
              socket.emit('escort-trip-error', error);
            }
          },
        })
        .then(() => {
          console.log(`escort consummer running`);
        })
        .catch((error) => {
          `Error:`, error;
        });
    } catch (error) {
      console.error(`Error in kafak adhoc consumer: ${error}`);
      socket.emit('escort-trip-error', error);
    }

    socket.on('disconnect', () => {
      console.log(`Escort trip consumer disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });

    consumer.on('consumer.crash', async (e) => {
      console.error('Escort consumer crashed, attempting to reconnect...', e);
      try {
        await consumer.disconnect();
        await consumer.connect();
        await consumer.subscribe({
          topic: 'escort-trip',
          fromBeginning: false,
        });
        console.log('Escort consumer reconnected');
      } catch (error) {
        console.error('Error reconnecting the consumer:', error.message);
        socket.emit('escort-trip-error', 'Failed to reconnect Kafka consumer');
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
  escortTripSocket,
};
