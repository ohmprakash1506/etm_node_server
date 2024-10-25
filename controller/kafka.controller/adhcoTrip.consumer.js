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

const consumer = kafka.consumer({ groupId: 'adhoctrip-trip-group' });
let adhocTripCount = 0;
let adhocData = [];
let activeSockets = [];

const adhocTripSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/adhocTrip',
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
      console.log(`Connected to adhoc topic`);
    })
    .catch((error) => {
      console.log(`Error connecting to adhoc topic: ${error}`);
    });

  await consumer
    .subscribe({
      topic: 'adhoc-trip',
      fromBeginning: false,
    })
    .then(() => {
      console.log(`Subscribed to adhoc topic`);
    })
    .catch((error) => {
      console.log(`Error subscribing to topic: ${error}`);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log(`Adhoc trip consumer connected`);
    activeSockets.push(socket);
    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('adhoc-trip-error', 'Corporate ID is required');
      return;
    }

    const sendAdhocCount = () => {
      activeSockets.forEach((sock) => {
        if (sock.handshake.query.corporateId === corporateId) {
          sock.emit('adhoc-trip-update', {
            count: adhocTripCount,
            vehicles: adhocData.filter(
              (data) => data.tripData.corporateId === corporateId
            ),
          });
        }
      });
    };

    try {
      await consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const adhocVehicleStatus = JSON.parse(message.value.toString());
              const { driverData, tripData, isActive } = adhocVehicleStatus;

              if (tripData.corporateId !== corporateId) {
                return;
              }

              const vehicleId = driverData.vehicleId;
              const existingVehicleIndex = adhocData.findIndex(
                (data) => data.driverData.vehicleId === vehicleId
              );

              if (isActive) {
                if (existingVehicleIndex === -1) {
                  adhocData.push(adhocVehicleStatus);
                  adhocTripCount++;
                } else {
                  adhocData[existingVehicleIndex] = adhocVehicleStatus;
                }
              } else {
                if (existingVehicleIndex !== -1) {
                  adhocData.splice(existingVehicleIndex, 1);
                  adhocTripCount--;
                }
              }

              adhocTripCount = Math.max(adhocTripCount, 0);

              sendAdhocCount();
            } catch (error) {
              console.error(`Error in Kafka adhoc consumer: ${error}`);
              socket.emit('adhoc-trip-error', error);
            }
          },
        })
        .then(() => {
          console.log(`Adhoc consumer running`);
        })
        .catch((error) => {
          console.log(`Error:`, error);
        });
    } catch (error) {
      console.error(`Error in Kafka adhoc consumer: ${error}`);
      socket.emit('adhoc-trip-error', error);
    }

    socket.on('disconnect', () => {
      console.log(`Adhoc trip consumer disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });

    consumer.on('consumer.crash', async (e) => {
      console.error('Adhoc consumer crashed, attempting to reconnect...', e);
      try {
        await consumer.disconnect();
        await consumer.connect();
        await consumer.subscribe({
          topic: 'adhoc-trip',
          fromBeginning: false,
        });
        console.log('Adhoc consumer reconnected');
      } catch (error) {
        console.error('Error reconnecting the consumer:', error.message);
        socket.emit('adhoc-trip-error', 'Failed to reconnect Kafka consumer');
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
  adhocTripSocket,
};
