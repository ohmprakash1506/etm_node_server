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

const consumer = kafka.consumer({ groupId: 'female-trip-group' });
let femaleTripCount = 0;
let femaleTripData = [];
let activeSockets = [];

const femaleTripSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/female/trip',
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
      console.log(`Connected to female-trip topic`);
    })
    .catch((error) => {
      console.log(`Error connecting to female topic: ${error}`);
    });

  await consumer
    .subscribe({
      topic: 'female-trip',
      fromBeginning: false,
    })
    .then(() => {
      console.log(`Subscribed to female-trip topic`);
    })
    .catch((error) => {
      console.log(`Error subscribing to female-trip topic: ${error}`);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log(`Female trip consumer connected`);
    activeSockets.push(socket);
    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('female-trip-error', 'Corporate ID is required');
      return;
    }

    const sendFemaleCount = () => {
      activeSockets.forEach((sock) => {
        if (sock.handshake.query.corporateId === corporateId) {
          sock.emit('female-trip-data', {
            count: femaleTripCount,
            vehicles: femaleTripData.filter(
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
              const femaleVehicleStatus = JSON.parse(message.value.toString());
              const { driverData, tripData, isActive } = femaleVehicleStatus;

              if (tripData.corporateId !== corporateId) {
                return; // Skip if the corporateId doesn't match
              }

              const vehicleId = driverData.vehicleId;
              const existingVehicleIndex = femaleTripData.findIndex(
                (data) => data.driverData.vehicleId === vehicleId
              );

              if (isActive) {
                if (existingVehicleIndex === -1) {
                  femaleTripData.push(femaleVehicleStatus);
                  femaleTripCount++;
                } else {
                  femaleTripData[existingVehicleIndex] = femaleVehicleStatus;
                }
              } else {
                if (existingVehicleIndex !== -1) {
                  femaleTripData.splice(existingVehicleIndex, 1);
                  femaleTripCount--;
                }
              }

              femaleTripCount = Math.max(femaleTripCount, 0);

              sendFemaleCount();
            } catch (error) {
              console.error(`Error in Kafka female trip consumer: ${error}`);
              socket.emit('female-trip-error', error);
            }
          },
        })
        .then(() => {
          console.log(`Female trip consumer running`);
        })
        .catch((error) => {
          console.log(`Error:`, error);
        });
    } catch (error) {
      console.error(`Error in Kafka female trip consumer: ${error}`);
      socket.emit('female-trip-error', error);
    }

    socket.on('disconnect', () => {
      console.log(`Female trip consumer disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });

    consumer.on('consumer.crash', async (e) => {
      console.error(
        'Female trip consumer crashed, attempting to reconnect...',
        e
      );
      try {
        await consumer.disconnect();
        await consumer.connect();
        await consumer.subscribe({
          topic: 'female-trip',
          fromBeginning: false,
        });
        console.log('Female-trip consumer reconnected');
      } catch (error) {
        console.error('Error reconnecting the consumer:', error.message);
        socket.emit('female-trip-error', 'Failed to reconnect Kafka consumer');
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
  femaleTripSocket,
};
