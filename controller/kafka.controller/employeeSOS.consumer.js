const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerurl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'consumer-api',
  brokers: [brokerurl],
});

const consumer = kafka.consumer({ groupId: 'employee-sos-group' });

const sosCounts = {};

const employeeSOSSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/employee/sos',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: 'sos-employee-alert',
    fromBeginning: false,
  });

  kafkaConsumer.on('connection', async (socket) => {
    console.log(`Employee SOS consumer connected`);

    const corporateId = socket.handshake.query.corporateId;

    if (!sosCounts[corporateId]) {
      sosCounts[corporateId] = { count: 0, data: {} };
    }

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const sosData = JSON.parse(message.value.toString());
          const messageCorporateId = sosData.employeeDetails.corporateId;
          const employeeId = sosData.employeeId;

          if (messageCorporateId === corporateId) {
            if (sosData.sosRaised) {
              if (!sosCounts[corporateId].data[employeeId]) {
                sosCounts[corporateId].count += 1;
              }

              sosCounts[corporateId].data[employeeId] = sosData;
            } else {
              if (sosCounts[corporateId].data[employeeId]) {
                sosCounts[corporateId].count = Math.max(
                  0,
                  sosCounts[corporateId].count - 1
                );
                delete sosCounts[corporateId].data[employeeId];
              }
            }

            socket.emit('employee-sos', {
              corporateId: corporateId,
              count: sosCounts[corporateId].count,
              data: Object.values(sosCounts[corporateId].data),
            });
          }
        } catch (error) {
          console.error(`Error processing message: ${error}`);
          socket.emit('employee-sos-error', error.message);
        }
      },
    });

    socket.on('disconnect', () => {
      console.log(`Driver SOS disconnected`);
    });
  });

};

module.exports = {
  employeeSOSSocket,
};
