module.exports = {
  async up(db, client) {
    await db.createCollection('waitingReports', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'driverId',
            'employeeId',
            'tripId',
            'locationReachedTime',
            'locationExitingTime',
            'passangerBoarded',
            'createdAt',
          ],
          properties: {
            driverId: {
              bsonType: 'string',
            },
            employeeId: {
              bsonType: 'string',
            },
            tripId: {
              bsonType: 'string',
            },
            locationReachedTime: {
              bsonType: 'string',
            },
            locationExitingTime: {
              bsonType: 'string',
            },
            passangerBoarded: {
              bsonType: 'string',
            },
            createdAt: {
              bsonType: 'date',
            },
            updatedAt: {
              bsonType: 'date',
            },
          },
        },
      },
    });
    console.log('"Waiting Report" collection created');
  },

  async down(db, client) {
    await db.collection('waitingReports').drop();
    console.log('"Device Details" Collection dropped');
  },
};
