const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerurl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerurl],
});

const consumer = kafka.consumer({ groupId: 'driver-sos-group' });

const sosCounts = {};

const driverSOSSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/driver/sos',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: 'sos-driver-alert',
    fromBeginning: false,
  });

  kafkaConsumer.on('connection', async (socket) => {
    console.log('Driver SOS consumer connected');
    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('driver-sos-error', 'Corporate ID is required');
      return;
    }

    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const sosData = JSON.parse(message.value.toString());
          const messageCorporateId = sosData.driverData.corporateId;
          const driverId = sosData.driverId;

          if (!sosCounts[messageCorporateId]) {
            sosCounts[messageCorporateId] = { count: 0, data: {} };
          }

          if (messageCorporateId === corporateId) {
            if (sosData.sosRaised) {
              if (!sosCounts[messageCorporateId].data[driverId]) {
                sosCounts[messageCorporateId].count += 1;
              }

              sosCounts[messageCorporateId].data[driverId] = sosData;
            } else {
              if (sosCounts[messageCorporateId].data[driverId]) {
                sosCounts[messageCorporateId].count = Math.max(
                  0,
                  sosCounts[messageCorporateId].count - 1
                );
                delete sosCounts[messageCorporateId].data[driverId];
              }
            }

            socket.emit('driver-sos', {
              corporateId: messageCorporateId,
              count: sosCounts[messageCorporateId].count,
              data: Object.values(sosCounts[messageCorporateId].data),
            });
          }
        } catch (error) {
          console.error(`Error processing message: ${error.message}`);
          socket.emit('driver-sos-error', error.message);
        }
      },
    });

    socket.on('disconnect', () => {
      console.log(`Driver SOS disconnected`);
    });
  });

};

module.exports = {
  driverSOSSocket,
};
