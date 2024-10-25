const client  = require('../../mongodb');
// const dbName = 'etravelmat';
const dbName = process.env.DATABASE;

function dateInMillisecond(val){
    const date = new Date(val);
    console.log('date :>> ', date);
    const milliseconds = date.getTime();
    return milliseconds;
}


exports.list = async (req, res) => {
    async function run() {
        try {
          const database = client.db(dbName);
          const employees = database.collection('EmployeeReg');
          const query = { employeeCode: 'VEL098' };
          const data = await employees.find(query).toArray();
          res.json({data: data})
          console.log(data);
        } finally {
          // Ensures that the client will close when you finish/error
          await client.close();
        }
      }
      run().catch(console.dir);
      
}



exports.shifts = async (req, res) => {
    console.log('req.auth :>> ', req.auth);
    async function run() {
        try {
          const database = client.db(dbName);
          const employees = database.collection('EmployeeReg');
          const department = database.collection('EmployeeDepartment');
          const shift = database.collection('EmployeeShift');
          const trip = database.collection('TripRouteDto');
         /* const data = await trip.aggregate( [
            {
               $match: { corporateId: req.params.id }
            },
            { $sort: {startTimeInMiliSec: -1} },
            { $lookup: {
                //searching collection name
                'from': 'EmployeeShift',
                //setting variable [searchId] where your string converted to ObjectId
                'let': {"searchId": {$toObjectId: "$shiftId"}}, 
                //search query with our [searchId] value
                "pipeline":[
                  {"$match": {"$expr":[ {"_id": "$$searchId"}]}},
                  {"$project":{"shiftName": 1}}
                ],

                'as': 'shiftData'

              }}
          ]).toArray();*/

          /*const data = await shift.aggregate([
            {
              "$addFields": {
                "sfId": {
                  "$toString": "$_id"
                },
              }
            },
            {
              "$lookup": {
                "from": "TripRouteDto",
                "localField": "sfId",
                "foreignField": "shiftId",
                "as": "shiftData"
              }
            }
          ]).toArray();*/



          const data = await trip.aggregate([
            {
                $match: { 
                    corporateId: req.body.corporateId,
                    startTimeInMiliSec: {$gte: dateInMillisecond(req.body.fromDate), $lt: dateInMillisecond(req.body.toDate)}
                }
            },
            { $sort: {startTimeInMiliSec: req.body.sort} },
            { $addFields: {newdate: dateInMillisecond(req.body.fromDate)}},
            { "$lookup": {
                "let": { "shiftObjId": { "$toObjectId": "$shiftId" } },
                "from": "EmployeeShift",
                "pipeline": [
                  { "$match": { "$expr": { "$eq": [ "$_id", "$$shiftObjId" ] } } },
                ],
                "as": "shiftDetails"
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
            }
          ]).toArray();
          
          var tempData = [];
          if(req.auth.userRole == "CORPORATEADMIN"){
            tempData = data;
          }else if(req.auth.userRoles.length){
            var isManager = false;
            req.auth.userRoles.forEach(roles => {
                if(roles.userRole == 'ROSTERADMIN'){
                    data.forEach(element => {
                        element.empDetails.forEach(sub => {
                            if(sub.managerId == req.auth.id){
                                tempData.push(element);
                            }
                        })
                    });
                }
            })
          }
          res.json({data: tempData, count: tempData.length})
          console.log(data);
        } finally {
          
          await client.close();
        }
      }
      run().catch(console.dir);      
}

