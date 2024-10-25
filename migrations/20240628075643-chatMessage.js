module.exports = {
  async up(db, client) {
    await db.createCollection('chatMessages', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'tripId',
            'employeeName',
            'employeeId',
            'mobileNo',
            'gender',
            'message',
            'timeStamp',
          ],
          properties: {
            tripId: {
              bsonType: 'string',
            },
            employeeName: {
              bsonType: 'string',
            },
            employeeId: {
              bsonType: 'string',
            },
            mobileNo: {
              bsonType: 'string',
            },
            gender: {
              bsonType: 'string',
            },
            message: {
              bsonType: 'string',
            },
            timeStamp: {
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
    console.log('"ChatMessages" collection created');
  },

  async down(db, client) {
    await db.collection('chatMessages').drop(); 
    console.log('"ChatMessages" Collection dropped');
  },
};
