const BSON = require("bson");
const client = require("../../mongodb");
// const dbName = "etravelmat"; //DEV
// const dbName = 'travelmat'; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;
const validator = require("../../validator");

const database = client.db(dbName);

function dateInMillisecond(val) {
  const date = new Date(val);
  console.log("date :>> ", date);
  const milliseconds = date.getTime();
  return milliseconds;
}

exports.employeeSearch = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection(req.body.collection);
      let aggregateCondition = [];
      let condition = [];
      let scon = "$or";
      let cid = req.auth.corporateId;

      const filters = req.body.search || [];
      const filterData = { $and: [{ corporateId: cid }] };
      if (req.auth.userRole == "VENDOR") {
        filterData["$and"] = [
          { corporateId: cid },
          { vendorId: req.auth.profileId },
        ];
      }
      const orData = filters.filter((ele) => ele.optr == "$or");
      const andData = filters.filter((ele) => ele.optr == "$and");
      if (orData.length) {
        orData.forEach((element) => {
          let tempData = {};
          if (element.value.includes("@")) {
            tempData = {
              emailId: {
                $regex: element.value,
                $options: "i",
              },
            };
          }else if (validator.isNumber(element.value)) {
            tempData = {
              mobileNo: {
                $regex: element.value,
                $options: "i",
              },
            };
          } else if (validator.isLetter(element.value)) {
            tempData = {
              firstName: {
                $regex: element.value,
                $options: "i",
              },
              lastName: {
                $regex: element.value,
                $options: "i",
              },
              managerName: {
                $regex: element.value,
                $options: "i",
              },
            };
          } else if (validator.mixLetter(element.value)) {
            tempData = {
              emailId: {
                $regex: element.value,
                $options: "i",
              }
            };
          }

          if (filterData && filterData["$or"]) {
            filterData["$or"] = [...filterData["$or"], tempData];
          } else {
            filterData["$or"] = [tempData];
          }
        });
      }

      if (andData.length) {
        andData.forEach((element) => {
          let tempData = {};
          if (element.value.includes("@")) {
            tempData = {
              emailId: {
                $regex: element.value,
                $options: "i",
              },
            };
          }else if (validator.isNumber(element.value)) {
            tempData = {
              mobileNo: {
                $regex: element.value,
                $options: "i",
              },
            };
          } else if (validator.isLetter(element.value)) {
            tempData = {
              firstName: {
                $regex: element.value,
                $options: "i",
              },
              lastName: {
                $regex: element.value,
                $options: "i",
              },
              managerName: {
                $regex: element.value,
                $options: "i",
              },
            };
          } else if (validator.mixLetter(element.value)) {
            tempData = {
              emailId: {
                $regex: element.value,
                $options: "i",
              },
              employeeCode: {
                $regex: element.value,
                $options: "i",
              },
            };
          }
          if (filterData && filterData["$and"]) {
            filterData["$and"] = [...filterData["$and"], tempData];
          } else {
            filterData["$and"] = [tempData];
          }
        });
      }
      console.log("filterData", filterData);
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
          message: "success",
          data: data,
          currentPage: req.body.pageNo,
          totalItems: totalItems,
          totalPages: Math.ceil(totalPages),
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: "No record found as per your data",
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

exports.employeeFilter = async (req, res) => {
  async function run() {
    try {
      const employeeData = database.collection(req.body.collection);
      let aggregateCondition = [];
      let condition = [];
      let scon = "$or";
      let cid = req.auth.corporateId;

      const filters = req.body.filters || [];
      const filterData = { $and: [{ corporateId: cid }] };
      if (req.auth.userRole == "VENDOR") {
        filterData["$and"] = [
          { corporateId: cid },
          { vendorId: req.auth.profileId },
        ];
      }
      const orData = filters.filter((ele) => ele.fieldOperator == "$or");
      const andData = filters.filter((ele) => ele.fieldOperator == "$and");
      if (orData.length) {
        orData.forEach((element) => {
          let tempData = {
            [element.field]: {
              [element.valueOperator]: element.value,
            },
          };
          if (element.valueOperator == "$regex") {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: "i",
              },
            };
          }
          if (filterData && filterData["$or"]) {
            filterData["$or"] = [...filterData["$or"], tempData];
          } else {
            filterData["$or"] = [tempData];
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
          if (element.valueOperator == "$regex") {
            tempData = {
              [element.field]: {
                [element.valueOperator]: element.value,
                $options: "i",
              },
            };
          }
          if (filterData && filterData["$and"]) {
            filterData["$and"] = [...filterData["$and"], tempData];
          } else {
            filterData["$and"] = [tempData];
          }
        });
      }
      console.log("filterData", filterData);
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
          message: "success",
          data: data,
          currentPage: req.body.pageNo,
          totalItems: totalItems,
          totalPages: Math.ceil(totalPages),
        });
      } else {
        return res.status(404).json({
          status: 404,
          message: "No record found as per your data",
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
