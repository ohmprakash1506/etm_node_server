module.exports = {
  async up(db, client) {
    await db.createCollection('crashreportdetails', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['ipAddress', 'deviceType', 'oS', 'activeStatus', 'appVersion', 'osVersion', 'locationPermission', 'batteryOptimisationStatus', 'error', 'errorInfo', 'createdAt'],
          properties: {
            ipAddress: {
              bsonType: 'string',
            },
            deviceType: {
              bsonType: 'string',
            },
            oS: {
              bsonType: 'string',
            },
            activeStatus: {
              bsonType: 'string',
            },
            appVersion: {
              bsonType: 'string',
            },
            osVersion: {
              bsonType: 'string',
            },
            locationPermission: {
              bsonType: 'string',
            },
            batteryOptimisationStatus: {
              bsonType: 'bool',
            },
            error: {
              bsonType: 'string',
            }, 
            errorInfo:{
              bsonType: 'string',
            }, 
            createdAt: {
              bsonType: 'date',
            },
            updatedAt: {
              bsonType: 'date',
            }
          }
        }
      }
    })
    console.log('"Device Details" collection created');
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    await db.collection('crashreportdetails').drop();
    console.log('"Device Details" Collection dropped');
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
  }
};
