const BSON = require("bson");
const axios = require("axios");
const request = require("request");
const client = require("../../mongodb");
const ObjectId = require('mongodb').ObjectId;
//const dbName = "etravelmat"; //DEV
//  const dbName = 'travelmat'; //UAT
// const dbName = 'etravelmateprod'; //
const cron = require('node-cron')
const qs = require('qs');
const moment = require('moment');
const dbName = process.env.DATABASE;

const { JsonDB, Config } = require('node-json-db');
const { urlencoded } = require('body-parser');
const { duration } = require('moment');
const { response } = require('express');
const jsonDB = new JsonDB(new Config('jsonDb', true, false, '/'));

const database = client.db(dbName);

const key = 'a8b8672edca2c84af64d377471c7149fe74eafcde007d33b';
const sid = process.env.EXOTEL_SID;
const token = '1203d7aa6a6bcce2f00febf522344a1df1e403bbe60a3bc9';
const user = process.env.EXOTEL_USERNAME;
const pass = process.env.EXOTEL_TOKEN;

function dateInMillisecond(val) {
  const date = new Date(val);
  console.log('date :>> ', date);
  const milliseconds = date.getTime();
  return milliseconds;
}

exports.ivrCall = async (req, res) => {
  const shift = database.collection('ivrcalls');
  const from = req.body.from;
  const to = req.body.to;

  const formUrlEncoded = (x) =>
    Object.keys(x).reduce(
      (p, c) => p + `&${c}=${encodeURIComponent(x[c])}`,
      ''
    );

  url =
    'https://' +
    key +
    ':' +
    token +
    '@api.exotel.in/v1/Accounts/' +
    sid +
    '/Calls/connect';
  axios
    .post(
      url,
      formUrlEncoded({
        From: from,
        To: to,
        CallerId: '080-694-51592',
        CallerType: 'trans',
      }),
      {
        withCredentials: true,
        headers: {
          Accept: 'application/x-www-form-urlencoded',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    .then((response) => {
      console.log(`statusCode: ${response.statusCode}`);
      console.log(response.data);
      res.status(200).json({
        status: 200,
        statusCode: response.statusCode,
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        status: 400,
        error: error,
      });
    });
};

exports.ivrCallDetails = async (req, res) => {
  // const shift = database.collection("ivrcalls");
  const fromDate = req.query.fromDate;
  const toDate = req.query.fromDate;
  const sortBy = req.query.sortBy;
  const pageSize = req.query.pageSize;
  const status = req.query.status;

  const url =
    'https://' +
    key +
    ':' +
    token +
    '@api.exotel.in/v1/Accounts/' +
    sid +
    '/Calls.json';

  axios
    .get(url, {
      DateCreated: 'gte:2023-05-29+00:00:00;lte:2023-06-30+23:59:59',
      SortBy: 'DateCreated:desc',
    })
    .then(function (response) {
      console.log(response);
      res.json({ status: '200', data: response.data });
    });
};

exports.ivrCallWeb = async (req, res) => {
  const from = req.body.from;
  const to = req.body.to;

  var options = {
    method: 'POST',
    url:
      'https://' +
      key +
      ':' +
      token +
      '@ccm-api.in.exotel.com/v2/accounts/' +
      sid +
      '/calls',
    headers: {
      'content-type': 'application/json',
      body: {
        from: { user_contact_uri: from },
        to: { customer_contact_uri: to },
        virtual_number: '+918069451592',
        recording: true,
        custom_field: '12130y124b2f142',
        status_callback: [
          { event: 'answered', url: 'https://your-server.com' },
          { event: 'terminal', url: 'https://your-server.com' },
        ],
      },
      json: true,
    },
  };
  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
    console.log('response', response);
    res.json({ status: '200', response });
  });
};

exports.ivrCallConnect = async (req, res) => {
  const from = req.body.from;
  const to = req.body.to;
  const r = (x) =>
    Object.keys(x).reduce(
      (p, c) => p + `&${c}=${encodeURIComponent(x[c])}`,
      ''
    );

  const axios = require('axios');

  url =
    'https://' +
    key +
    ':' +
    token +
    '@api.exotel.in/v1/Accounts/' +
    sid +
    '/Calls/connect.json';
  axios
    .post(
      url,
      r({
        From: from,
        To: to,
        CallerId: '080-694-51592',
        CallerType: 'trans',
        Url: 'http://my.exotel.com/Exotel/exoml/start_voice/26555',
      }),
      {
        withCredentials: true,
        headers: {
          Accept: 'application/x-www-form-urlencoded',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    .then((res) => {
      console.log(`statusCode: ${res.statusCode}`);
      console.log(res);
      res.json({ status: '200', res });
    })
    .catch((error) => {
      console.error(error);
      res.json({ status: '400', error });
    });
};

exports.ivrPrmConnectInitate = async (req, res) => {
  //const callFrom = req.query.from;
  //const callTo = req.query.to;
  console.log('req.body', req.body);
  await jsonDB.push('/ivrCall/' + '0' + req.body.callFrom.mobileNo, req.body);

  res.json({ status: '200', message: 'call initated' });
};

exports.ivrPrmConnect = async (req, res) => {
  const callFrom = req.query.CallFrom;

  try {
    var ivrCall = await jsonDB.getData('/ivrCall/' + callFrom);

    var data = {
      fetch_after_attempt: false,
      destination: {
        numbers: [ivrCall.callTo.mobile],
      },
      outgoing_phone_number: '08069453543',
      record: true,
      recording_channels: 'dual',
      max_ringing_duration: 45,
      max_conversation_duration: 3600,
      music_on_hold: {
        type: 'operator_tone',
      },
      start_call_playback: {
        playback_to: 'both',
        type: 'text',
        value: 'This call is from eTravelMate',
      },
    };
    console.log('req.body', data);
    res.json(data);
  } catch (error) {
    // The error will tell you where the DataPath stopped. In this case test1
    // Since /test1/test does't exist.
    // console.error(error);
    res.json(error);
  }
};

exports.ivrPrmConnectDrop = async (req, res) => {
  const ivrcalls = database.collection('ivrcalls');
  const { CallFrom, CallSid, CallTo, CallType } = req.query;
  var callDetails = await jsonDB.getData('/ivrCall/' + CallFrom);
  // const driver = await driverColl.findOne({mobileNo: CallFrom})
  setTimeout(() => {
    //https://<your_api_key>:<your_api_token>@ccm-api.in.exotel.com/v3/accounts/<your_sid>/calls/<call_sid>
    var options = {
      method: 'GET',
      url:
        'https://' +
        key +
        ':' +
        token +
        '@api.exotel.in/v1/Accounts/' +
        sid +
        '/Calls/' +
        CallSid +
        '.json',
      headers: { 'content-type': 'application/json' },
    };

    request(options, function (error, response, body) {
      if (error) {
        res.json(error);
      } else {
        console.log('response', JSON.parse(response.body).Call);
        var cald = JSON.parse(response.body).Call;
        var data = {
          callId: CallSid,
          from: cald.From,
          to: cald.To,
          startTime: cald.StartTime,
          endTime: cald.EndTime,
          callType: CallType,
          callerId: CallTo,
          callStatus: cald.Status,
          duration: cald.Duration,
          price: cald.Price,
          createdAt: new Date(),
          ...callDetails,
        };
        try {
          ivrcalls.insertOne(data);
          res.json(data);
        } catch (error) {
          res.json(error);
        }
      }
    });
  }, 2000);
};

exports.ivrCallsDataCount = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection('ivrcalls');
      let aggregateCondition = [];
      let condition = [];
      let scon = '$or';
      let cid = req.auth.corporateId;

      if (!cid) {
        return res.status(404).json({
          status: 404,
          message: 'Invalid Token',
          data: [],
        });
      }

      let cidKey = 'corporateId';

      const filters = req.body.filters || [];
      const filterData = {
        $and: [
          { [cidKey]: cid },
          {
            createdAt: {
              $gte: new Date(req.body.from + 'T00:00:00Z'),
              $lt: new Date(req.body.to + 'T03:59:59Z'),
            },
          },
        ],
      };
      if (req.auth.userRole == 'VENDOR') {
        filterData['$and'] = [
          { [cidKey]: cid },
          { vendorId: req.auth.profileId },
          {
            createdAt: {
              $gte: new Date(req.body.from + 'T00:00:00Z'),
              $lt: new Date(req.body.to + 'T03:59:59Z'),
            },
          },
        ];
      }
      const orData = filters.filter((ele) => ele.fieldOperator == '$or');
      const andData = filters.filter((ele) => ele.fieldOperator == '$and');
      if (orData.length) {
        orData.forEach((element) => {
          let tempData = {
            [element.field]: {
              [element.valueOperator]: element.value,
            },
          };
          if (element.valueOperator == '$regex') {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: 'i',
              },
            };
          }
          if (filterData && filterData['$or']) {
            filterData['$or'] = [...filterData['$or'], tempData];
          } else {
            filterData['$or'] = [tempData];
          }
        });
      }

      if (andData.length) {
        andData.forEach((element) => {
          let tempData = {
            [element.field]: {
              [element.valueOperator]: element.value,
            },
          };
          if (element.valueOperator == '$regex') {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: 'i',
              },
            };
          }
          if (filterData && filterData['$and']) {
            filterData['$and'] = [...filterData['$and'], tempData];
          } else {
            filterData['$and'] = [tempData];
          }
        });
      }
      console.log('filterData', filterData);
      aggregateCondition.push({
        $match: filterData,
      });

      //employee data
      const data = await employeeData
        .aggregate([
          ...aggregateCondition,
          {
            $facet: {
              Totalcount: [
                { $count: 'count' },
                { $project: { _id: 0, Total_cases: '$count' } },
              ],
              status_counts: [
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, callStatus: '$_id' } },
              ],
              completed_sum: [
                {
                  $group: { _id: '$callStatus', count: { $sum: '$duration' } },
                },
                { $project: { _id: 0, count: 1, callStatus: '$_id' } },
              ],
              comp_type_duration: [
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: '$duration' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    callStatus: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              type_counts: [
                { $group: { _id: '$callType', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, callType: '$_id' } },
              ],
            },
          },
          { $addFields: { created_date: new Date() } },
          {
            $project: {
              Total: {
                $first: '$Totalcount.Total_cases',
              },
              Completed: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$status_counts',
                        cond: {
                          $eq: ['$$this.callStatus', 'completed'],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              ComDuration: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$completed_sum',
                        cond: {
                          $eq: ['$$this.callStatus', 'completed'],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              ComDriverDuration: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$comp_type_duration',
                        cond: {
                          $and: [
                            { $eq: ['$$this.callStatus', 'completed'] },
                            { $eq: ['$$this.type', 'dte'] },
                          ],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              ComEmpDuration: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$comp_type_duration',
                        cond: {
                          $and: [
                            { $eq: ['$$this.callStatus', 'completed'] },
                            { $eq: ['$$this.type', 'etd'] },
                          ],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              Missed: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$status_counts',
                        cond: {
                          $ne: ['$$this.callStatus', 'completed'],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              Employee: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$type_counts',
                        cond: {
                          $eq: ['$$this.callType', 'etd'],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
              Driver: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: '$type_counts',
                        cond: {
                          $eq: ['$$this.callType', 'dte'],
                        },
                      },
                    },
                  },
                  {
                    count: 0,
                  },
                ],
              },
            },
          },
          {
            $project: {
              Total: 1,
              Completed: '$Completed.count',
              ComDuration: '$ComDuration.count',
              Missed: '$Missed.count',
              Employee: '$Employee.count',
              Driver: '$Driver.count',
              DriverDuration: '$ComDriverDuration.count',
              EmpDuration: '$ComEmpDuration.count',
            },
          },
        ])
        .toArray();

      if (data.length > 0) {
        return res.status(200).json({
          status: 200,
          message: 'success',
          data: data,
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: 'No record found as per your data',
          data: [],
        });
      }
    } finally {
      //await client.close();
    }
  }
  run().catch(console.dir);
};

exports.ivrCallsDataCountByDate = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection('ivrcalls');
      let cid = req.auth.corporateId;

      if (!cid) {
        return res.status(404).json({
          status: 404,
          message: 'Invalid Token',
          data: [],
        });
      }

      //employee data
      const data = await employeeData
        .aggregate([
          {
            $addFields: {
              date: {
                $dateToString: {
                  date: { $toDate: '$startTime' },
                  format: '%Y-%m-%d',
                },
              },
              time: {
                $dateToString: {
                  date: { $toDate: '$startTime' },
                  format: '%H:%M:%S:%L%z',
                },
              },
            },
          },
          {
            $match: {
              corporateId: cid,
              createdAt: {
                $gte: new Date(req.body.from + 'T00:00:00Z'),
                $lt: new Date(req.body.to + 'T03:59:59Z'),
              },
            },
          },
          {
            $facet: {
              all_dates: [
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_by_date: [
                {
                  $group: {
                    _id: { date: '$date', status: '$callStatus' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    date: '$_id.date',
                    status: '$_id.status',
                  },
                },
              ],
              count_status_and_type: [
                {
                  $group: {
                    _id: {
                      date: '$date',
                      status: '$callStatus',
                      type: '$callType',
                    },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    date: '$_id.date',
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
            },
          },
          {
            $project: {
              all_dates: '$all_dates',
              count_by_date: '$count_status_by_date',
              count_comp: {
                $filter: {
                  input: '$count_status_by_date',
                  cond: {
                    $eq: ['$$this.status', 'completed'],
                  },
                },
              },
              count_missed: {
                $filter: {
                  input: '$count_status_by_date',
                  cond: {
                    $ne: ['$$this.status', 'completed'],
                  },
                },
              },
              count_by_type: '$count_status_and_type',
              count_by_dte: {
                $filter: {
                  input: '$count_status_and_type',
                  cond: {
                    $eq: ['$$this.type', 'dte'],
                  },
                },
              },
              count_by_etd: {
                $filter: {
                  input: '$count_status_and_type',
                  cond: {
                    $eq: ['$$this.type', 'etd'],
                  },
                },
              },
            },
          },
        ])
        .toArray();

      if (data.length > 0) {
        return res.status(200).json({
          status: 200,
          message: 'success',
          data: data,
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: 'No record found as per your data',
          data: [],
        });
      }
    } finally {
      //await client.close();
    }
  }
  run().catch(console.dir);
};

exports.ivrCallsDataCountForToday = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection('ivrcalls');
      let cid = req.auth.corporateId;

      const { from, to } = req.body;

      if (!cid) {
        return res.status(404).json({
          status: 404,
          message: 'Invalid Token',
          data: [],
        });
      }

      //employee data
      const data = await employeeData
        .aggregate([
          {
            $match: { corporateId: cid },
          },
          {
            $facet: {
              time_00_04_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T00:00:00Z'),
                      $lt: new Date(to + 'T03:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_00_04: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T00:00:00Z'),
                      $lt: new Date(to + 'T03:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_00_04: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T00:00:00Z'),
                      $lt: new Date(to + 'T03:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              time_04_08_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T04:00:00Z'),
                      $lt: new Date(to + 'T07:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_04_08: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T04:00:00Z'),
                      $lt: new Date(to + 'T07:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_04_08: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T04:00:00Z'),
                      $lt: new Date(to + 'T07:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              time_08_12_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T08:00:00Z'),
                      $lt: new Date(to + 'T11:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_08_12: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T08:00:00Z'),
                      $lt: new Date(to + 'T11:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_08_12: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T08:00:00Z'),
                      $lt: new Date(to + 'T11:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              time_12_16_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T12:00:00Z'),
                      $lt: new Date(to + 'T15:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_12_16: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T12:00:00Z'),
                      $lt: new Date(to + 'T15:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_12_16: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T12:00:00Z'),
                      $lt: new Date(to + 'T15:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              time_16_20_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T16:00:00Z'),
                      $lt: new Date(to + 'T19:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_16_20: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T16:00:00Z'),
                      $lt: new Date(to + 'T19:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_16_20: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T16:00:00Z'),
                      $lt: new Date(to + 'T19:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
              time_20_00_total: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T20:00:00Z'),
                      $lt: new Date(to + 'T23:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$date', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, date: '$_id' } },
              ],
              count_status_20_00: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T20:00:00Z'),
                      $lt: new Date(to + 'T23:59:59Z'),
                    },
                  },
                },
                { $group: { _id: '$callStatus', count: { $sum: 1 } } },
                { $project: { _id: 0, count: 1, status: '$_id' } },
              ],
              count_type_20_00: [
                {
                  $match: {
                    createdAt: {
                      $gte: new Date(from + 'T20:00:00Z'),
                      $lt: new Date(to + 'T23:59:59Z'),
                    },
                  },
                },
                {
                  $group: {
                    _id: { status: '$callStatus', type: '$callType' },
                    count: { $sum: 1 },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    count: 1,
                    status: '$_id.status',
                    type: '$_id.type',
                  },
                },
              ],
            },
          },
          {
            $project: {
              count_status_00_04: '$count_status_00_04',
              count_status_04_08: '$count_status_04_08',
              count_status_08_12: '$count_status_08_12',
              count_status_12_16: '$count_status_12_16',
              count_status_16_20: '$count_status_16_20',
              count_status_20_00: '$count_status_20_00',
              count_comp_00_04: {
                $filter: {
                  input: '$count_status_00_04',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_comp_04_08: {
                $filter: {
                  input: '$count_status_04_08',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_comp_08_12: {
                $filter: {
                  input: '$count_status_08_12',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_comp_12_16: {
                $filter: {
                  input: '$count_status_12_16',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_comp_16_20: {
                $filter: {
                  input: '$count_status_16_20',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_comp_20_00: {
                $filter: {
                  input: '$count_status_20_00',
                  cond: { $eq: ['$$this.status', 'completed'] },
                },
              },
              count_missed_00_04: {
                $filter: {
                  input: '$count_status_00_04',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_missed_04_08: {
                $filter: {
                  input: '$count_status_04_08',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_missed_08_12: {
                $filter: {
                  input: '$count_status_08_12',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_missed_12_16: {
                $filter: {
                  input: '$count_status_12_16',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_missed_16_20: {
                $filter: {
                  input: '$count_status_16_20',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_missed_20_00: {
                $filter: {
                  input: '$count_status_20_00',
                  cond: { $ne: ['$$this.status', 'completed'] },
                },
              },
              count_dte_00_04: {
                $filter: {
                  input: '$count_type_00_04',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_dte_04_08: {
                $filter: {
                  input: '$count_type_04_08',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_dte_08_16: {
                $filter: {
                  input: '$count_type_08_12',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_dte_12_16: {
                $filter: {
                  input: '$count_type_12_16',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_dte_16_20: {
                $filter: {
                  input: '$count_type_16_20',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_dte_20_00: {
                $filter: {
                  input: '$count_type_20_00',
                  cond: { $eq: ['$$this.type', 'dte'] },
                },
              },
              count_etd_00_04: {
                $filter: {
                  input: '$count_type_00_04',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
              count_etd_04_08: {
                $filter: {
                  input: '$count_type_04_08',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
              count_etd_08_16: {
                $filter: {
                  input: '$count_type_08_12',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
              count_etd_12_16: {
                $filter: {
                  input: '$count_type_12_16',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
              count_etd_16_20: {
                $filter: {
                  input: '$count_type_16_20',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
              count_etd_20_00: {
                $filter: {
                  input: '$count_type_20_00',
                  cond: { $eq: ['$$this.type', 'etd'] },
                },
              },
            },
          },
        ])
        .toArray();

      if (data.length > 0) {
        return res.status(200).json({
          status: 200,
          message: 'success',
          data: data,
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: 'No record found as per your data',
          data: [],
        });
      }
    } finally {
      //await client.close();
    }
  }
  run().catch(console.dir);
};

exports.ivrCallsFilter = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection('ivrcalls');
      let aggregateCondition = [];
      let condition = [];
      let scon = '$or';
      let cid = req.auth.corporateId;

      /*if(!cid){
        return res.status(404).json({
          status: 404,
          message: "Invalid Token",
          data: [],
        });
      }*/

      let cidKey = 'corporateId';

      const filters = req.body.filters || [];
      const filterData = {
        $and: [
          { [cidKey]: cid },
          {
            createdAt: {
              $gte: new Date(req.body.from + 'T00:00:00Z'),
              $lt: new Date(req.body.to + 'T03:59:59Z'),
            },
          },
        ],
      };
      if (req.auth.userRole == 'VENDOR') {
        filterData['$and'] = [
          { [cidKey]: cid },
          { vendorId: req.auth.profileId },
          {
            createdAt: {
              $gte: new Date(req.body.from + 'T00:00:00Z'),
              $lt: new Date(req.body.to + 'T03:59:59Z'),
            },
          },
        ];
      }
      const orData = filters.filter((ele) => ele.fieldOperator == '$or');
      const andData = filters.filter((ele) => ele.fieldOperator == '$and');
      if (orData.length) {
        orData.forEach((element) => {
          let tempData = {
            [element.field]: {
              [element.valueOperator]: element.value,
            },
          };
          if (element.valueOperator == '$regex') {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: 'i',
              },
            };
          }
          if (filterData && filterData['$or']) {
            filterData['$or'] = [...filterData['$or'], tempData];
          } else {
            filterData['$or'] = [tempData];
          }
        });
      }

      if (andData.length) {
        andData.forEach((element) => {
          let tempData = {
            [element.field]: {
              [element.valueOperator]: element.value,
            },
          };
          if (element.valueOperator == '$regex') {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: 'i',
              },
            };
          }
          if (filterData && filterData['$and']) {
            filterData['$and'] = [...filterData['$and'], tempData];
          } else {
            filterData['$and'] = [tempData];
          }
        });
      }
      console.log('filterData', filterData);
      aggregateCondition.push({
        $match: filterData,
      });

      //employee data
      const data = await employeeData
        .aggregate([
          ...aggregateCondition,
          {
            $sort: {
              createdOn: -1,
            },
          },
          {
            $skip: (req.body.pageNo - 1) * req.body.pageSize,
          },
          {
            $limit: req.body.pageSize,
          },
        ])
        .toArray();

      // const data = await employeeData.aggregate([
      //     ...aggregateCondition
      //   ]).toArray();

      //count data
      const countItem = await employeeData
        .aggregate([
          ...aggregateCondition,
          { $group: { _id: null, myCount: { $sum: 1 } } },
          { $project: { _id: 0 } },
        ])
        .toArray();
      let totalItems = countItem.length > 0 ? countItem[0].myCount : 0;
      let totalPages =
        totalItems > req.body.pageSize
          ? parseFloat(totalItems) / parseFloat(req.body.pageSize)
          : 1;
      if (data.length > 0) {
        return res.status(200).json({
          status: 200,
          message: 'success',
          data: data,
          currentPage: req.body.pageNo,
          totalItems: totalItems,
          totalPages: Math.ceil(totalPages),
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: 'No record found as per your data',
          data: [],
        });
      }

      // return res.status(404).json({
      //     status: 404,
      //     message: "No record found as per your data",
      //     data
      //   });
      //   console.log(data);
    } finally {
      //   await client.close();
    }
  }
  run().catch(console.dir);
};

exports.countIvrCallApi = async (req, res) => {
  const corpId = req.query.corpId;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  let today = moment().format('YYYY-MM-DD');
  let dateRange = {};

  dateRange.$gte = startDate ? moment(startDate).format('YYYY-MM-DD') : today;
  console.log(`date:`, dateRange);
  if (endDate) {
    const nextDay = moment(endDate).add(1, 'days');
    dateRange.$lte = nextDay.format('YYYY-MM-DD');
  }

  const ivrCallCollection = database.collection('ivrcalls');

  const callPipeLine = [
    {
      $match: {
        corporateId: corpId,
      },
    },
    {
      $addFields: {
        createdDate: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $toDate: '$createdOn' },
          },
        },
      },
    },
    {
      $match: {
        createdDate: dateRange,
      },
    },
    {
      $set: {
        callerNumber: '$from',
      },
    },
    {
      $facet: {
        statusCounts: [
          {
            $group: {
              _id: '$callStatus',
              totalCalls: { $sum: 1 },
            },
          },
        ],
        driverCount: [
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'callerNumber',
              foreignField: 'mobileNo',
              as: 'driverInfo',
            },
          },
          {
            $match: {
              'driverInfo.0': { $exists: true },
            },
          },
          {
            $count: 'count',
          },
        ],
        employeeCount: [
          {
            $lookup: {
              from: 'EmployeeReg',
              localField: 'callerNumber',
              foreignField: 'mobileNo',
              as: 'employeeInfo',
            },
          },
          {
            $match: {
              'employeeInfo.0': { $exists: true },
            },
          },
          {
            $count: 'count',
          },
        ],
        totalDuration: [
          {
            $group: {
              _id: null,
              totalDuration: {
                $sum: {
                  $cond: {
                    if: {
                      $and: [
                        { $ne: ['$duration', null] },
                        { $ne: ['$duration', ''] },
                        { $ne: ['$duration', false] },
                        { $type: '$duration' },
                        { $isNumber: { $toInt: '$duration' } },
                      ],
                    },
                    then: { $toInt: '$duration' },
                    else: 0,
                  },
                },
              },
            },
          },
        ],
      },
    },
    {
      $project: {
        statusCounts: {
          $arrayToObject: {
            $map: {
              input: '$statusCounts',
              as: 'status',
              in: {
                k: '$$status._id',
                v: '$$status.totalCalls',
              },
            },
          },
        },
        driverCount: { $arrayElemAt: ['$driverCount.count', 0] },
        employeeCount: { $arrayElemAt: ['$employeeCount.count', 0] },
        totalDuration: { $arrayElemAt: ['$totalDuration.totalDuration', 0] },
      },
    },
  ];

  try {
    const callStatusCount = await ivrCallCollection
      .aggregate(callPipeLine)
      .toArray();
    if (!callStatusCount) {
      return res.status(403).send({ response: `No record found` });
    }
    res.status(200).send({ response: callStatusCount });
  } catch (error) {
    res.status(500).send({ message: error });
    console.log(error);
  }
};

exports.makeIvrCall = async (req, res) => {
  const from = req.body.From;
  const to = req.body.To;
  const callerId = req.body.CallerId;
  const callType = req.body.CallType;
  const data = {
    From: '0' + from,
    To: '0' + to,
    CallerId: callerId,
    CallType: callType,
    Record: true,
  };
  const postData = qs.stringify(data);
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://${user}:${pass}@api.exotel.com/v1/Accounts/${sid}/Calls/connect.json`,
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: postData,
  };

  try {
    const response = await axios.request(config);
    return res.status(200).send({ response: response.data });
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

exports.postTripData = async (req, res) => {
  const callSid = req.body.callSid;
  const tripCode = ObjectId(req.body.tripCode);
  const calledOn = moment().format('YYYY-MM-DD HH:mm:ss');
  const date = moment().format('YYYY-MM-DD');

  const driverCollection = database.collection('DriverReg');
  const employeeCollection = database.collection('EmployeeReg');
  const tripCollection = database.collection('TripRouteDto');
  const ivrCollection = database.collection('ivrcalls');

  try {
    const url = `https://${user}:${pass}@api.exotel.com/v1/Accounts/${sid}/Calls/${callSid}.json`;

    const response = await axios.get(url, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const callDetails = response.data.Call;

    const fromNum = callDetails.From;
    const toNum = callDetails.To;

    const from = fromNum.replace(/^0+/, '');
    const to = toNum.replace(/^0+/, '');

    const findNumber = async (collection, number) => {
      let contactDetails = await collection
        .aggregate([
          {
            $match: {
              mobileNo: number,
            },
          },
          {
            $project: {
              mobileNo: 1,
              firstName: 1,
              lastName: 1,
            },
          },
        ])
        .toArray();
      return contactDetails[0] || {};
    };

    let dailer = await findNumber(driverCollection, from);
    if (!dailer.firstName) {
      dailer = await findNumber(employeeCollection, from);
    }

    let receiver = await findNumber(driverCollection, to);
    if (!receiver.firstName) {
      receiver = await findNumber(employeeCollection, to);
    }

    let pipeline = [
      {
        $match: {
          _id: tripCode,
        },
      },
      {
        $lookup: {
          from: 'EmployeeShift',
          let: {
            shiftId: {
              $toObjectId: '$shiftId',
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$shiftId'],
                },
              },
            },
          ],
          as: 'shiftDetails',
        },
      },
      {
        $unwind: {
          path: '$shiftDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          tripCode: 1,
          routeName: 1,
          tripType: 1,
          tripCategory: 1,
          shiftName: 1,
          vehicleNo: 1,
          vehicleType: 1,
          corporateId: 1,
          vendorId: 1,
          shiftId: '$shiftDetails._id',
          shiftStart: '$shiftDetails.shiftStart',
          shiftEnd: '$shiftDetails.shiftEnd',
          shiftName: '$shiftDetails.shiftName',
          remarks: '$shiftDetails.remarks',
          pickupType: '$shiftDetails.pickupType',
          status: '$shiftDetails.status',
          createdOn: '$shiftDetails.createdOn',
          createdBy: '$shiftDetails.createdBy',
          updatedOn: '$shiftDetails.updatedOn',
          updatedBy: '$shiftDetails.updatedBy',
          _class: '$shiftDetails._class',
        },
      },
    ];

    let tripData = await tripCollection.aggregate(pipeline).toArray();
    tripData = tripData[0] || {};

    let shiftType;
    let tripType;

    if (tripData.tripCode.startsWith('U')) {
      shiftType = 'Login';
    } else {
      shiftType = 'Logout';
    }

    if (tripData.tripCategory.startsWith('REG')) {
      tripType = 'Regular';
    } else {
      tripType = 'Adhoc';
    }

    const direction = callDetails.Direction ? callDetails.Direction : '';
    const duration = callDetails.Duration
      ? callDetails.Duration.toString()
      : '';
    const price = callDetails.Price ? callDetails.Price.toString() : '';

    let result = {
      callId: callDetails.Sid,
      from: callDetails.From.replace(/^0+/, ''),
      to: callDetails.To.replace(/^0+/, ''),
      startTime: callDetails.StartTime,
      endTime: callDetails.EndTime,
      callStatus: callDetails.Status,
      callType: direction,
      createdOn: calledOn,
      date: date,
      details: '',
      duration: duration,
      price: price,
      callRecording: callDetails.RecordingUrl,
      dailer: `${dailer.firstName} ${dailer.lastName}`,
      reciever: `${receiver.firstName} ${receiver.lastName}`,
      corporateId: tripData.corporateId,
      vendorId: tripData.vendorId,
      tripId: tripData._id.toString(),
      tripCode: tripData.tripCode,
      tripType: tripType,
      shiftTime: tripData.shiftStart,
      shiftName: tripData.shiftName,
      shiftType: shiftType,
      vehicleNo: tripData.vehicleNo,
      vehicleType: tripData.vehicleType,
    };

    const ivrData = await ivrCollection.insertOne(result);
    if (!ivrData) {
      return res.status(403).send({ message: `Error in saving ivr Data` });
    }
    return res.status(200).send({ response: ivrData });
  } catch (error) {
    res.status(500).send({ message: error });
    console.log(`Error:`, error);
  }
};

exports.getIvrCallDeatils = async (req, res) => {
  const callSid = req.query.callSid;
  const url = `https://${user}:${pass}@api.exotel.com/v1/Accounts/${sid}/Calls/${callSid}.json`;
  try {
    const response = await axios.get(url, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.status(200).send({ response: response.data });
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

exports.getBulkCallDeatils = async (req, res) => {
  const url = `https://${user}:${pass}@api.exotel.com/v1/Accounts/${sid}/Calls.json`;
  try {
    const response = await axios.get(url, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.status(200).send({ response: response.data });
  } catch (error) {
    res.status(500).send({ message: error });
  }
};

exports.getAllCallDetails = async (req, res) => {
  const corpId = req.query.corpId;
  const skip = req.query.skip;
  const limit = req.query.limit;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  let today = moment().format('YYYY-MM-DD');
  let dateRange = {};

  dateRange.$gte = startDate ? moment(startDate).format('YYYY-MM-DD') : today;

  if (endDate) {
    const nextDay = moment(endDate).add(1, 'days');
    dateRange.$lte = nextDay.format('YYYY-MM-DD');
  }

  const skipRange = parseInt(skip ? skip : 0);
  const limitRange = parseInt(limit ? limit : 10);
  if (!corpId) {
    return res.status(403).send({ message: `Crop Id is required` });
  }
  try {
    const ivrCallData = database.collection('ivrcalls');
    const pipeline = [
      {
        $match: {
          corporateId: corpId,
        },
      },
      {
        $addFields: {
          createdDate: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $toDate: '$createdOn',
              },
            },
          },
        },
      },
      {
        $match: {
          createdOn: dateRange,
        },
      },
      {
        $sort: {
          createdOn: 1,
        },
      },
      {
        $facet: {
          metadata: [
            {
              $count: 'total',
            },
            {
              $addFields: {
                page: 1,
              },
            },
          ],
          data: [
            {
              $skip: skipRange,
            },
            {
              $limit: limitRange,
            },
          ],
        },
      },
    ];

    const result = await ivrCallData.aggregate(pipeline).toArray();

    return res.status(200).send({ response: result });
  } catch (error) {
    res.status(500).send({ message: error });
    console.log(error);
  }
};

exports.startScheduler = async () => {
  cron.schedule('* * * * *', async () => {
    const date = moment().format('YYYY-MM-DD HH:mm:ss');
    const callIvrAPI = async () => {
      const callData = database.collection('ivrcalls');
      const callerID = await callData
        .find({ callStatus: { $eq: 'in-progress' } })
        .toArray();
      for (let call of callerID) {
        const url = `https://${user}:${pass}@api.exotel.com/v1/Accounts/${sid}/Calls/${call.callId}.json`;
        try {
          const response = await axios.get(url, {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const result = response.data.Call;
          const duration = result.Duration ? result.Duration.toString() : '';
          const price = result.Price ? result.Price.toString() : '';

          if (result) {
            await callData.updateOne(
              { callId: result.Sid },
              {
                $set: {
                  callStatus: result.Status,
                  startTime: result.StartTime,
                  endTime: result.EndTime,
                  duration: duration,
                  price: price,
                  callRecording: result.RecordingUrl,
                },
              }
            );
            console.log(
              `Updated callId: ${result.Sid} with status: ${result.Status}`
            );
          }
        } catch (error) {
          console.log(`Error:`, error);
        }
      }
    };
    await callIvrAPI();
  });
};
