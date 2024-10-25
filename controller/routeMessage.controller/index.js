const mongoose = require('mongoose');
const client = require('../../mongodb');
const dbName = process.env.DATABASE;
const database = client.db(dbName);
const ObjectId = require('mongodb').ObjectId;
const { Server } = require('socket.io');
const { ChatMessages } = require('../../models/chatMessage');
const moment = require('moment');

const getRoutePassengersList = async (tripId, collection) => {
  try {
    const employeeData = database.collection(collection);

    if (!employeeData) {
      throw new Error(`Employee data not found`);
    }

    let pipeline = [
      {
        $match: {
          tripCode: `${tripId}`,
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
          _id: 0,
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
      throw new Error(`Error fetching data`);
    }

    const allowedEmployees = result.reduce((acc, item) => {
      item.onBoardPassengerDetails
        .flat()
        .forEach((passenger) => acc.add(passenger.empId));
      item.deBoardPassengerDetails
        .flat()
        .forEach((passenger) => acc.add(passenger.empId));
      return acc;
    }, new Set());
    return allowedEmployees;
  } catch (error) {
    console.error('Error in getRoutePassengersList:', error);
    return error;
  }
};

const getTripPassengers = async (req, res) => {
  const rolename = req.auth.userRole;
  if (rolename !== 'INVALID') {
    try {
      const collection = req.query.collection;
      const tripId = req.query.tripId;
      const employeeData = database.collection(collection);

      if (!employeeData) {
        throw new Error(`Employee data not found`);
      }

      let pipeline = [
        {
          $match: {
            tripCode: `${tripId}`,
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
            _id: 0,
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

        return {
          tripCode: item.tripCode,
          passengers: mergedPassengers,
        };
      });

      res.status(200).send({ result: response });
    } catch (error) {
      res.status(500).send({ message: error });
    }
  } else {
    res.status(403).send({ message: `You don't have access` });
  }
};

const getGropuchat = async (req, res) => {
  const rolename = req.auth.userRole;
  if (rolename !== 'INVALID') {
    try {
      const collection = req.query.collection;
      const employeeCollection = req.query.employeeCollection;
      const tripId = req.query.tripId;
      const chatData = database.collection(collection);
      const employeeData = database.collection(employeeCollection);

      let pipeLine = [
        {
          $match: {
            tripId: `${tripId}`,
          },
        },
        {
          $project: {
            tripId: 1,
            employeeId: 1,
            employeeName: 1,
            message: 1,
            timeStamp: 1,
          },
        },
      ];

      const result = await chatData.aggregate(pipeLine).toArray();
      if (!result) {
        return res.status(401).send({ message: `Error fetching data` });
      }

      for (let i = 0; i < result.length; i++) {
        const objectId = new mongoose.Types.ObjectId(result[i].employeeId);
        const employeePhoto = await employeeData.findOne(
          { _id: objectId, status: 'ACTIVE' },
          { projection: { photo: 1, _id: 0 } }
        );
        if (employeePhoto) {
          result[i].employeePhoto = employeePhoto.photo;
        }
      }

      res.status(200).send({ response: result });
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  } else {
    res.status(403).send({ message: `You don't have access` });
  }
};

const inTripChat = async (server) => {
  const io3 = new Server(server, {
    path: '/api/intripChat',
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  try {
    io3.on('connection', async (socket) => {
      const timeStamp = moment().format('HH:mm:ss A');

      socket.on('message', async (data) => {
        const allowedEmployees = await getRoutePassengersList(
          data.tripId,
          data.collection
        );
        const { tripId, employeeName, employeeId, mobileNo, gender, message } =
          data;
        if (!allowedEmployees.has(employeeId)) {
          socket.emit('error', 'You are not allowed to chat in this session');
          return;
        }

        const newChatMessage = new ChatMessages({
          tripId: tripId,
          employeeName,
          employeeId,
          mobileNo,
          gender,
          message,
          timeStamp: timeStamp,
        });

        try {
          await newChatMessage.save();
        } catch (error) {
          console.log(`Error saving chat message:`, error);
        }

        socket.emit('message', message);
      });

      socket.on('disconnect', () => {
        console.log(`Chatbot is closed`);
      });
    });
  } catch (error) {
    console.error('Error initializing inTripChat:', error);
  }

  return io3;
};

module.exports = {
  inTripChat,
  getTripPassengers,
  getGropuchat
};
