const { Kafka } = require('kafkajs');
const { Server } = require('socket.io');
const brokerUrl = process.env.KAFKA_BROKER;

const kafka = new Kafka({
  clientId: 'employee-api',
  brokers: [brokerUrl],
  retry: {
    retries: 5,
  },
});

const consumer = kafka.consumer({ groupId: 'employee-trip-group' });
let activeEmployeeTripCount = 0;
let employeeTripData = [];
let activeSockets = [];

const specialEmployeeSocket = async (server) => {
  const kafkaConsumer = new Server(server, {
    path: '/api/special/employee/consumer',
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
      console.log(`Connected to employee trip topic`);
    })
    .catch((error) => {
      console.log(`Error connecting to Kafka:`, error);
    });

  await consumer
    .subscribe({
      topic: 'special-employee-trip',
      fromBeginning: false,
    })
    .then(() => {
      console.log(`Subscribed to employee-trip-location topic`);
    })
    .catch((error) => {
      console.log(`Error subscribing to Kafka topic:`, error);
    });

  kafkaConsumer.on('connection', async (socket) => {
    console.log('Employee trip consumer connected');
    activeSockets.push(socket);

    const corporateId = socket.handshake.query.corporateId;

    if (!corporateId) {
      socket.emit('special-employee-error', 'Corporate ID is required');
      return;
    }

    const sendEmployeeTripCount = () => {
      activeSockets.forEach((sock) => {
        sock.emit('special-employee-update', {
          count: activeEmployeeTripCount,
          employeeTrips: employeeTripData,
        });
      });
    };

    try {
      await consumer
        .run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const employeeTripStatus = JSON.parse(message.value.toString());

              const { employeeDetails, vehicleDetails, tripDetails, isActive } =
                employeeTripStatus;
              const tripId = tripDetails._id;

              const existingTripIndex = employeeTripData.findIndex(
                (trip) => trip.tripDetails._id === tripId
              );

              // Update the employee trip data
              if (isActive) {
                if (existingTripIndex === -1) {
                  employeeTripData.push(employeeTripStatus);
                  activeEmployeeTripCount++;
                } else {
                  employeeTripData[existingTripIndex] = employeeTripStatus;
                }
              } else {
                if (existingTripIndex !== -1) {
                  employeeTripData.splice(existingTripIndex, 1);
                  activeEmployeeTripCount--;
                }
              }

              activeEmployeeTripCount = Math.max(activeEmployeeTripCount, 0);

              sendEmployeeTripCount();
            } catch (error) {
              console.error(`Error processing message: ${error.message}`);
              socket.emit('special-employee-error', error.message);
            }
          },
        })
        .then(() => {
          console.log(`Consumer is running for employee-trip-location`);
        })
        .catch((error) => {
          console.log(`Error:`, error);
        });
    } catch (error) {
      console.error(`Error in Kafka consumer: ${error.message}`);
      socket.emit('special-employee-error', 'Kafka consumer error');
    }

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Employee trip consumer disconnected`);
      activeSockets = activeSockets.filter((s) => s.id !== socket.id);
    });

    // Kafka consumer crash handling
    consumer.on('consumer.crash', async (e) => {
      console.error('Consumer crashed, attempting to reconnect...', e);
      try {
        await consumer.disconnect();
        await consumer.connect();
        await consumer.subscribe({
          topic: 'special-employee-trip',
          fromBeginning: false,
        });
        console.log('Consumer reconnected');
      } catch (error) {
        console.error('Error reconnecting the consumer:', error.message);
        socket.emit(
          'special-employee-error',
          'Failed to reconnect Kafka consumer'
        );
      }
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await consumer.disconnect();
    process.exit(0);
  });
};

module.exports = {
  specialEmployeeSocket,
};
