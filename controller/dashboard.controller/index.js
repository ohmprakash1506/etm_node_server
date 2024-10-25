const BSON = require('bson');
const client  = require('../../mongodb');
// const dbName = 'etravelmat'; //DEV
// const dbName = 'travelmat'; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;

const database = client.db(dbName);

function dateInMillisecond(val){
    const date = new Date(val);
    console.log('date :>> ', date);
    const milliseconds = date.getTime();
    return milliseconds;
}


exports.list = async (req, res) => {
    async function run() {
        try {
        //   const database = client.db(dbName);
          const employees = database.collection('EmployeeReg');
          const query = { employeeCode: 'VEL098' };
          const data = await employees.find(query).toArray();
          res.json({data: data})
          console.log(data);
        } finally {
          // Ensures that the client will close when you finish/error
        //   await client.close();
        }
      }
      run().catch(console.dir);
      
}



exports.shifts = async (req, res) => {
    async function run() {
        try {
        //   const database = client.db(dbName);
          const shift = database.collection('EmployeeShift');
          const trip = database.collection('TripRouteDto');
       /* const data = await shift.aggregate([
            {
                $match: { 
                    corpId: req.body.corporateId,
                    //startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
                }
            },
            { "$lookup": {
                "let": { "shiftId": { $toString: "$_id" } },
                "from": "TripRouteDto",
                "pipeline": [
                  { 
                    $match: { "$expr": { "$eq": [ "$shiftId", "$$shiftId" ] }, startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)} },                    
                  },
                ],
                "as": "trips"
            }},
        ]).toArray();*/
          let match = { 
            corporateId: req.body.corporateId,
            startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
          };
          if(req.auth.userRole == "VENDOR"){
            match = { 
              corporateId: req.body.corporateId,
              vendorId: req.auth.profileId,
              startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
            };
          }
          const data = await trip.aggregate([
            {
                $match: match
            },
            { $addFields: {newdate: dateInMillisecond(req.body.fromDate)}},
            { "$lookup": {
                "let": { "shiftObjId": { "$toObjectId": "$shiftId" } },
                "from": "EmployeeShift",
                "pipeline": [
                  { "$match": { "$expr": { "$eq": [ "$_id", "$$shiftObjId" ] } } },
                ],
                "as": "shiftDetail"
            }},
            { "$lookup": {
              from : "RoutePassenger",
              localField : "stopList.onBoardPassengers.$id",
              foreignField : "_id",
              as: "routePsDetails"
          }},
          {
              $addFields: {
                empIds: {
                  $map: {
                    input: "$routePsDetails",
                    in: {
                      $mergeObjects: ["$$this", { empId: { $toObjectId: "$$this.empId" } }]
                    }
                  }
                }
              }
          },
          {
              $lookup: {
                from: "EmployeeReg",
                localField: "empIds.empId",
                foreignField: "_id",
                as: "empDetails"
              }
          },
            {$unwind: {path: "$shiftDetail"}},
            {$project: {
                shiftId: "$shiftId", 
                shiftName: "$shiftDetail.shiftName", 
                shiftType: "$shiftDetail.shiftType",
                shiftStart: "$shiftDetail.shiftStart",
                shiftEnd: "$shiftDetail.shiftEnd",
                tripType: "$tripType",
                tripCategory: "$tripCategory",
                tripDate: "$date",
                tripTime: "$startTime",
                tripStatus: "$status",
                empDetails: "$empDetails",
                startTimeInMiliSec: "$startTimeInMiliSec",
              }
            },
            { $sort: {startTimeInMiliSec: req.body.sort} },
          ]).toArray();
          console.log('req.auth', req.auth)
          var tempData = [];
          if(req.auth.userRole == "CORPORATEADMIN" || req.auth.userRole == "TANENTADMIN"){
            data.forEach(element => {
              const {empDetails, ...rest} = element;  
              let tdupdate = true;            
              tempData.forEach(td => {
                if(td.shiftId == element.shiftId && td.tripType == element.tripType &&  td.tripDate == element.tripDate){
                  if(td.tripStatus == "SCHEDULE"){
                    td.tripStatus = element.tripStatus
                  }
                  tdupdate = false;
                }
              })
              if(tdupdate)
              tempData.push(rest);
            });
          }else if(req.auth.userRole == 'ROSTERADMIN'){
            console.log('req.auth :>> ', req.auth);
            data.forEach(element => {
                element.empDetails.forEach(sub => {
                    if(sub.managerId == req.auth.profileId){
                        const {empDetails, ...rest} = element;
                        let tdupdate = true;
                        tempData.forEach(td => {
                          if(td.shiftId == element.shiftId && td.tripType == element.tripType &&  td.tripDate == element.tripDate){
                            if(td.tripStatus == "SCHEDULE"){
                              td.tripStatus = element.tripStatus
                            }
                            tdupdate = false;
                          }
                        })
                        if(tdupdate)
                        tempData.push(rest);
                    }
                })
            })
          }else if(req.auth.userRole == 'EMPLOYEE'){
            data.forEach(element => {
                element.empDetails.forEach(sub => {
                    if(sub._id == req.auth.profileId){
                        const {empDetails, ...rest} = element;
                        let tdupdate = true;
                        tempData.forEach(td => {
                          if(td.shiftId == element.shiftId && td.tripType == element.tripType &&  td.tripDate == element.tripDate){
                            if(td.tripStatus == "SCHEDULE"){
                              td.tripStatus = element.tripStatus
                            }
                            tdupdate = false;
                          }
                        })
                        if(tdupdate)
                        tempData.push(rest);
                    }
                })
            })
          }else if(req.auth.userRole == "VENDOR"){
            data.forEach(element => {
              const {empDetails, ...rest} = element;     
              let tdupdate = true;         
              tempData.forEach(td => {
                if(td.shiftId == element.shiftId && td.tripType == element.tripType &&  td.tripDate == element.tripDate){
                  if(td.tripStatus == "SCHEDULE"){
                    td.tripStatus = element.tripStatus
                  }
                  tdupdate = false;
                }
              })
              if(tdupdate)
              tempData.push(rest);
            });
          }
          res.json({data: tempData, count: data.length})
        //   console.log(data);
        } finally {
        //   await client.close();
        }
      }
      run().catch(console.dir);      
}


exports.roastered = async (req, res) => {
  // console.log('new Date(req.body.fromData).toISOString()', new Date(req.body.fromDate).toISOString())
    async function run() {
        try {
        //   const database = client.db(dbName);
        //   const shift = database.collection('EmployeeShift');
          const empRoasterData = database.collection('EmployeeRoasterData');
        //   const trip = database.collection('TripRouteDto');
          let match = {logoutShiftId: req.body.shiftId}, dateCol = "$logoutDate";

          if(req.body.type == "login"){
            dateCol = "$date";
            match = {loginShiftId: req.body.shiftId}
          }
          const data = await empRoasterData.aggregate([
            {$addFields: {newDate: {$toDate: dateCol }}},
            {
                '$match': {...match, newDate: {$gte: new Date(req.body.fromDate), $lt: new Date(req.body.toDate)}}
            }
          ]).toArray();
          
          
          res.json({data: data, count: data.length})
          console.log(data);
        } finally {
        //   await client.close();
        }
      }
      run().catch(console.dir);      
}

exports.trips = async (req, res) => {
    async function run() {
        try {
        //   const database = client.db(dbName);
          const trip = database.collection('TripRouteDto');

          const data = await trip.aggregate([
            {
                $match: { 
                    shiftId: req.body.shiftId,
                    tripType: req.body.tripType,
                    // startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
                    startTimeInMiliSec: {$eq: dateInMillisecond(req.body.fromDate)}
                }
            },
            // { $sort: {startTimeInMiliSec: req.body.sort} },
            { $facet: {
                trips: [
                    { $group: { _id: "$status", count: { $sum : 1 }}}
                ],                
                total: [{
                    $count: "totalCount"
                }]
            }}
          ]).toArray();
          
          const tempData = {schedule: 0, completed: 0, cancled: 0, started: 0, total: 0}

          if(data.length){
            data[0].trips.forEach(trp => {
                tempData[trp._id.toLowerCase()] = trp.count;
            })
            tempData.total = data[0].total[0].totalCount;
          }
          res.json(tempData)
        //   console.log(data);
        } finally {
        //   await client.close();
        }
      }
      run().catch(console.dir);      
}

exports.tripsByShift = async (req, res) => {
    async function run() {
        try {
          const trip = database.collection('TripRouteDto');

          const data = await trip.aggregate([
            {
                $match: { 
                    shiftId: req.body.shiftId,
                    tripType: req.body.tripType,
                    date: req.body.date
                    // startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
                    
                }
            },
            { "$lookup": {
                "let": { "shiftObjId": { "$toObjectId": "$shiftId" } },
                "from": "EmployeeShift",
                "pipeline": [
                  { "$match": { "$expr": { "$eq": [ "$_id", "$$shiftObjId" ] } } },
                ],
                "as": "shiftDetails"
            }},
            { 
              "$lookup": {
              "let": { "vehicleObjId": { "$toObjectId": "$vehicleId" } },
              "from": "VehicleReg",
              "pipeline": [
                { "$match": { "$expr": { "$eq": [ "$_id", "$$vehicleObjId" ] } } },
                { 
                  "$lookup": {
                  "let": { "vehicleTypeObjId": { "$toObjectId": "$vehicleTypeId" } },
                  "from": "VehicleType",
                  "pipeline": [
                    { "$match": { "$expr": { "$eq": [ "$_id", "$$vehicleTypeObjId" ] } } },
                  ],
                  "as": "vehicleTypeDetail"
                }},
                {$unwind: {path: "$vehicleTypeDetail"}},
              ],
              "as": "vehicleDetail"
            }},
            { "$lookup": {
                from : "RoutePassenger",
                localField : "stopList.onBoardPassengers.$id",
                foreignField : "_id",
                as: "routePsDetails"
            }},
            {
                $addFields: {
                  empIds: {
                    $map: {
                      input: "$routePsDetails",
                      in: {
                        $mergeObjects: ["$$this", { empId: { $toObjectId: "$$this.empId" } }]
                      }
                    }
                  }
                }
            },
            {
                $lookup: {
                  from: "EmployeeReg",
                  localField: "empIds.empId",
                  foreignField: "_id",
                  as: "empDetails"
                }
            },
            // { $facet: {
            //     roastered: [{ $group: { _id: "$status", count: { $sum : 1 }} }],
            //     trips: [
            //         { $group: { _id: "$status", count: { $sum : 1 }} }
            //     ],                
            //     total: [{
            //         $count: "totalCount"
            //     }]
            // }}
          ]).toArray();
          
        //   const tempData = {schedule: 0, completed: 0, cancled: 0, started: 0, total: 0}

        //   if(data.length){
        //     data[0].trips.forEach(trp => {
        //         tempData[trp._id.toLowerCase()] = trp.count;
        //     })
        //     tempData.total = data[0].total[0].totalCount;
        //   }
          res.json(data)
        //   console.log(data);
        } finally {
        //   await client.close();
        }
      }
      run().catch(console.dir);      
}