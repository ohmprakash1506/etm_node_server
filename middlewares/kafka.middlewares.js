const client = require('../mongodb/index');
const dbName = process.env.DATABASE;
const database = client.db(dbName);
const ObjectId = require('mongodb').ObjectId;
const moment = require('moment');

const getCollectionData = async (collection) => {
  try {
    const record = database.collection(collection);
    if (!record) {
      throw new Error(`${collection} data not found`);
    }

    return record;
  } catch (error) {
    throw new Error(`data not found error : ${error}`);
  }
};

const fetchDriverdetails = async (collectionName, driverId, vehicleId) => {
  try {
    const collection = collectionName;
    const driverData = database.collection(collection);

    if (!driverData) {
      throw new Error(`Driver data not found`);
    }
    const response = await driverData
      .aggregate([
        {
          $match: {
            driverId: driverId,
            vehicleId: vehicleId,
            status: 'ACTIVE',
          },
        },
        {
          $lookup: {
            from: 'DriverReg',
            let: {
              driverId: {
                $toObjectId: '$driverId',
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$_id', '$$driverId'],
                  },
                },
              },
            ],
            as: 'result',
          },
        },
        {
          $unwind: '$result',
        },
        {
          $project: {
            driverId: 1,
            vehicleId: 1,
            driverName: 1,
            driverMobileNo: 1,
            vehicleNumber: 1,
            driverPhoto: '$result.photo',
            corporateId: 1,
          },
        },
      ])
      .toArray();

    return response ? response : [];
  } catch (error) {
    console.log(error);
    return [];
  }
};

const fetchEmployeeDetails = async (
  employeeCollection,
  vehicleCollection,
  tripCollection,
  empId,
  vehicleId,
  tripId
) => {
  try {
    const employeeData = await getCollectionData(employeeCollection);
    const vehicleData = await getCollectionData(vehicleCollection);
    const tripData = await getCollectionData(tripCollection);

    const [employeeDetails, vehicleDetails, tripDetails] = await Promise.all([
      employeeData
        .aggregate([
          {
            $match: {
              _id: ObjectId(empId),
              profileStatus: 'ACTIVE',
            },
          },
          {
            $project: {
              _id: 1,
              employeeFullName: 1,
              employeeCode: 1,
              gender: 1,
              mobileNo: 1,
              emailId: 1,
              officeId: 1,
              officeName: 1,
              department: 1,
              corporateId: 1,
              specificNeedType: 1,
            },
          },
        ])
        .toArray(),

      vehicleData
        .aggregate([
          {
            $match: {
              _id: ObjectId(vehicleId),
              status: 'ACTIVE',
            },
          },
          {
            $project: {
              _id: 1,
              tenantId: 1,
              corporateId: 1,
              vendorId: 1,
              modelName: 1,
              fuelType: 1,
              vehicleBrand: 1,
              vehicleTypeName: 1,
              vehicleName: 1,
            },
          },
        ])
        .toArray(),

      tripData
        .aggregate([
          {
            $match: {
              _id: ObjectId(tripId),
            },
          },
          {
            $lookup: {
              from: 'DriverReg',
              let: {
                driverId: {
                  $toObjectId: '$driverId',
                },
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ['$_id', '$$driverId'],
                    },
                  },
                },
              ],
              as: 'result',
            },
          },
          {
            $unwind: '$result',
          },
          {
            $project: {
              _id: 1,
              tripCode: 1,
              tripType: 1,
              tripCategory: 1,
              corporateId: 1,
              shiftName: 1,
              escortTrip: 1,
              driverId: 1,
              driverName: 1,
              driverMobileNo: 1,
              driverPhoto: '$result.photo',
            },
          },
        ])
        .toArray(),
    ]);

    const empDetails = employeeDetails || [];
    const vehDetails = vehicleDetails || [];
    const tripDetailsArr = tripDetails || [];

    if (!empDetails.length || !vehDetails.length || !tripDetailsArr.length) {
      return { employeeDetails: [], vehicleDetails: [], tripDetails: [] };
    }

    return {
      employeeDetails: empDetails,
      vehicleDetails: vehDetails,
      tripDetails: tripDetailsArr,
    };
  } catch (error) {
    console.error('Error in fetchEmployeeDetails:', error);
    return { employeeDetails: [], vehicleDetails: [], tripDetails: [] };
  }
};

const fetchTripPassengers = async (collectionName, tripCode) => {
  try {
    const collection = collectionName;
    const employeeData = database.collection(collection);

    if (!employeeData) {
      throw new Error(`Employee data not found`);
    }

    const _id = ObjectId(tripCode);
    let pipeline = [
      {
        $match: {
          _id: _id,
        },
      },
      {
        $unwind: {
          path: '$stopList',
        },
      },
      {
        $project: {
          _id: 1,
          tripCode: 1,
          stopPointName: '$stopList.stopPointName',
          onBoardPassengers: '$stopList.onBoardPassengers',
          deBoardPassengers: '$stopList.deBoardPassengers',
          tripCategory: 1,
          corporateId: 1,
          escortTrip: 1,
        },
      },
      {
        $lookup: {
          from: 'RoutePassenger',
          localField: 'onBoardPassengers.$id',
          foreignField: '_id',
          as: 'onBoardPassengerDetails',
        },
      },
      {
        $lookup: {
          from: 'RoutePassenger',
          localField: 'deBoardPassengers.$id',
          foreignField: '_id',
          as: 'deBoardPassengerDetails',
        },
      },
      {
        $group: {
          _id: '$tripCode',
          tripCode: { $first: '$tripCode' },
          onBoardPassengerDetails: { $push: '$onBoardPassengerDetails' },
          deBoardPassengerDetails: { $push: '$deBoardPassengerDetails' },
          tripCategory: { $first: '$tripCategory' },
          corporateId: { $first: '$corporateId' },
          tripId: { $first: '$_id' },
          escortTrip: { $first: '$escortTrip' },
        },
      },
      {
        $project: {
          _id: 0,
          tripId: 1,
          tripCode: 1,
          tripCategory: 1,
          corporateId: 1,
          escortTrip: 1,
          onBoardPassengerDetails: {
            $reduce: {
              input: '$onBoardPassengerDetails',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
          deBoardPassengerDetails: {
            $reduce: {
              input: '$deBoardPassengerDetails',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
    ];
    const result = await employeeData.aggregate(pipeline).toArray();

    if (!result) {
      return [];
    }

    const response = result.map((item) => {
      const transformPassenger = (passenger) => ({
        _id: passenger._id,
        employeeName: passenger.name ? passenger.name : '',
        gender: passenger.gender ? passenger.gender : '',
      });

      const combinedPassengers = [
        ...item.onBoardPassengerDetails.flat().map(transformPassenger),
        ...item.deBoardPassengerDetails.flat().map(transformPassenger),
      ];

      const mergedPassengers = combinedPassengers.filter(
        (value, index, self) =>
          index ===
          self.findIndex((t) => t._id.toString() === value._id.toString())
      );

      let tripMates;
      if (item.escortTrip === 'YES') {
        tripMates = 'blue';
      } else if (
        mergedPassengers.some((passenger) => passenger.gender === 'Female')
      ) {
        tripMates = 'pink';
      } else {
        tripMates = 'yellow';
      }
      return {
        tripId: item.tripId,
        tripCode: item.tripCode,
        corporateId: item.corporateId,
        tripCategory: item.tripCategory,
        tripMates,
      };
    });

    return response;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getFirstEmployeeData = async (collection, tripId) => {
  try {
    const employeeData = database.collection(collection);
    let boardedEmployee;

    if (!employeeData) {
      throw new Error(`Employee data not found`);
    }

    let pipeline = [
      {
        $match: {
          _id: ObjectId(tripId),
        },
      },
      {
        $unwind: {
          path: '$stopList',
        },
      },
      {
        $project: {
          tripCode: 1,
          stopPointName: '$stopList.stopPointName',
          onBoardPassengers: '$stopList.onBoardPassengers',
          deBoardPassengers: '$stopList.deBoardPassengers',
        },
      },
      {
        $lookup: {
          from: 'RoutePassenger',
          localField: 'onBoardPassengers.$id',
          foreignField: '_id',
          as: 'onBoardPassengerDetails',
        },
      },
      {
        $lookup: {
          from: 'RoutePassenger',
          localField: 'deBoardPassengers.$id',
          foreignField: '_id',
          as: 'deBoardPassengerDetails',
        },
      },
      {
        $group: {
          _id: '$tripCode',
          tripCode: { $first: '$tripCode' },
          onBoardPassengerDetails: { $push: '$onBoardPassengerDetails' },
          deBoardPassengerDetails: { $push: '$deBoardPassengerDetails' },
        },
      },
      {
        $project: {
          _id: 1,
          tripCode: 1,
          onBoardPassengerDetails: {
            $reduce: {
              input: '$onBoardPassengerDetails',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
          deBoardPassengerDetails: {
            $reduce: {
              input: '$deBoardPassengerDetails',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
    ];

    const result = await employeeData.aggregate(pipeline).toArray();

    if (!result) {
      return res.status(401).send({ message: `Error fetching data` });
    }

    const response = result.map((item) => {
      const transformPassenger = (passenger) => ({
        _id: passenger._id,
        employeeName: passenger.name ? passenger.name : '',
        photo: passenger.photo ? passenger.photo : '',
        empId: passenger.empId ? passenger.empId : '',
        empCode: passenger.empCode ? passenger.empCode : '',
        emailId: passenger.emailId ? passenger.emailId : '',
        mobileNo: passenger.mobileNo ? passenger.mobileNo : '',
        gender: passenger.gender ? passenger.gender : '',
        expectedArivalTime: passenger.expectedArivalTime
          ? moment(passenger.expectedArivalTime).format('YYYY-MM-DD HH:mm:ss')
          : '',
        status: passenger.status ? passenger.status : '',
        corporateId: passenger.corporateId ? passenger.corporateId : '',
      });

      const combinedPassengers = [
        ...item.onBoardPassengerDetails.flat().map(transformPassenger),
        ...item.deBoardPassengerDetails.flat().map(transformPassenger),
      ];

      const passengerMap = new Map();

      combinedPassengers.forEach((passenger) => {
        if (passengerMap.has(passenger.empId)) {
          const existingPassenger = passengerMap.get(passenger.empId);
          passengerMap.set(passenger.empId, {
            ...existingPassenger,
          });
        } else {
          passengerMap.set(passenger.empId, passenger);
        }
      });

      const mergedPassengers = Array.from(passengerMap.values());
      for (const passenger of mergedPassengers) {
        if (passenger.status == 'BOARDED') {
          boardedEmployee = passenger;
          break;
        }
      }
      console.log(`boardedData:`, boardedEmployee);

      return boardedEmployee;
    });

    return response ? response : [];
  } catch (error) {
    console.log(`Error:`, error);
  }
};

module.exports = {
  fetchDriverdetails,
  fetchTripPassengers,
  fetchEmployeeDetails,
  getFirstEmployeeData,
};
