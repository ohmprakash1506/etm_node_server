const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerUrl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerUrl],
});

const consumer = kafka.consumer({ groupId: 'first-pickup-delay-group' });
let firstPickupDelayCount = 0;
let firstpickUpDelayData = [];
let activeSockets = [];

const fristPickupDelaySocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/first/pickup/delay',
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  await consumer
    .connect()
    .then(() => {
      console.log(`connected to first-pickup-delay topic `);
    })
    .catch((error) => {
      console.log(`error captured at first-pickup-delay topic: ${error}`);
    });

  await consumer
    .subscribe({
      topic: 'first-pickup-delay',
      fromBeginning: false,
    })
    .then(() => {
      console.log(`subscribed to female trip topic`);
    })
    .catch((error) => {
      console.log(`error subscribing to female trip topic: ${error}`);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log(`first-pickup-delay consumer connected`);
    activeSockets.push(socket);
    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('first-pickup-delay-error', 'Corporate ID is required');
      return;
    }

    const sendFirstDelayCount = () => {
      activeSockets.forEach((sock) => {
        sock.emit('first-pickup-delay', {
          count: firstPickupDelayCount,
          vehicles: firstpickUpDelayData,
        });
      });
    };

    try {
      await consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const firstpickUpDelayDataStatus = JSON.parse(
                message.value.toString()
              );

              const { driverData, tripData, isActive } =
                firstpickUpDelayDataStatus;
              const vehicleId = driverData.vehicleId;

              const existingVehicleIndex = firstpickUpDelayData.findIndex(
                (data) => data.driverData.vehicleId === vehicleId
              );

              if (isActive) {
                if (existingVehicleIndex === -1) {
                  firstpickUpDelayData.push(firstpickUpDelayDataStatus);
                  firstPickupDelayCount++;
                } else {
                  firstpickUpDelayData[existingVehicleIndex] =
                    firstpickUpDelayDataStatus;
                }
              } else {
                if (existingVehicleIndex !== -1) {
                  firstpickUpDelayData.splice(existingVehicleIndex, 1);
                  firstPickupDelayCount--;
                }
              }

              firstPickupDelayCount = Math.max(firstPickupDelayCount, 0);

              sendFirstDelayCount();
            } catch (error) {
              console.error(`Error processing message: ${error.message}`);
              socket.emit('first-pickup-delay-error', error.message);
            }
          },
        })
        .then(() => {
          console.log(`First pick up delay consummer running`);
        })
        .catch((error) => {
          `Error:`, error;
        });
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
      socket.emit('first-pickup-delay-error', error.message);
    }

    socket.on('disconnect', () => {
      console.log(`First pick up delay consumer disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Received Message ${message.value} from topic ${topic}`);
    },
  });
};

module.exports = {
  fristPickupDelaySocket,
};
