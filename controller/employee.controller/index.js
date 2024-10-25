const BSON = require("bson");
const client = require("../../mongodb");
//const dbName = "etravelmat"; //DEV
//  const dbName = "travelmat"; //UAT
 const dbName = process.env.DATABASE
//const dbName = 'etravelmateprod'; //PROD
const validator = require("../../validator");
const searchCollection = require("./search.collections");
const database = client.db(dbName);

function dateInMillisecond(val) {
  const date = new Date(val);
  const milliseconds = date.getTime();
  return milliseconds;
}

const docAttrs = [
  "employeeCode",
  "managerName",
  "gender",
  "mobileNo",
  "emailId",
  "officeName",
  "companyName",
  "tanentName",
  "residenceAddress.addressName",
  "shiftName",
  "employeeFullName",
  "designation",
  "department",
  "pickupLocation",
  "specificNeedType",
  "employeeCategory",
  "alternateContactNo",
  "businessUnit",
  "firstName",
  "lastName",
  "departmentName",
  "status",
  "description",
  "companyName",
  "companyCode",
  "companyRegNo",
  "companyPAN",
  "companyGSTN",
  "contactPersonFirstName",
  "contactPersonLastName",
  "vehicleBrand",
  "fuelType",
  "vehicleColor",
  "ownerName",
  "ownerEmail",
  "ownerMobile",
];


const associateVehicleDriver = {
  AssociateDriver: [
    'vendorCode',
    'vendorName',
    'address.addressName',
    'mobileNo',
    'emailId',
    'firstName',
    'lastName',
    'dlNumber',
  ],
  AssociateVehicle: [
    'vendorName',
    'ownerEmail',
    'vehicleNumberPlate',
    'vehicleBrand',
    'fuelType',
    'modelName',
  ],
  AssociateVendor: ['vendorName', 'status', 'emailId', 'mobileNo'],
  TanentReg: [
    'companyName',
    'companyCode',
    'mobileNo',
    'emailId',
    'branchName',
  ],
};

exports.employeeSearch = async (req, res) => {
  // console.log(req.auth, "req.auth req.authreq.authreq.authreq.authreq.auth")

  const dbCollections = [
    'AssociateDriver',
    'AssociateVehicle',
    'AssociateVendor',
  ];

  if (dbCollections.includes(req.body.collection)) {
    const searchedCollection = req.body.collection;
    const roleName = req.auth.userRole;

    async function goForSearch() {
      const ObjectId = require('mongodb').ObjectId;
      const DBRef = require('mongodb').DBRef;
      const searchedData = database.collection(searchedCollection);
      const aggregateCondition = [];
      const matchQuery = [];
      associateVehicleDriver[searchedCollection].forEach((ele) => {
        matchQuery.push({
          [ele]: { $regex: req.body.search, $options: 'i' },
        });
      });

      if (searchedCollection == 'AssociateVendor') {
        const cid = req.auth.corporateId;
        let queryString;
        if (roleName == 'VENDOR') {
          queryString = {
            $match: {
              vendor: DBRef('CorporateReg', ObjectId(req.auth.profileId)),
            },
          };
        } else {
          queryString = {
            $match: {
              corporate: DBRef('CorporateReg', ObjectId(cid)),
            },
          };
        }

        aggregateCondition.push(
          queryString,
          {
            $lookup: {
              from: 'VendorReg',
              localField: 'vendor.$id',
              foreignField: '_id',
              as: 'vendorInfo',
            },
          },
          {
            $project: {
              vendorInfo: { $first: '$vendorInfo' },
            },
          },
          {
            $project: {
              _id: '$vendorInfo._id',
              vendorId: '$vendorInfo._id',
              vendorName: '$vendorInfo.vendorName',
              status: '$vendorInfo.status',
              createdOn: '$vendorInfo.createdOn',
              updateOn: '$vendorInfo.updateOn',
              tenantId: '$vendorInfo.tenantId',
              mobileNo: '$vendorInfo.mobileNo',
              emailId: '$vendorInfo.emailId',
              contactPersonFirstName: '$vendorInfo.contactPersonFirstName',
              contactPersonLastName: '$vendorInfo.contactPersonLastName',
              companyPAN: '$vendorInfo.companyPAN',
              accountName: '$vendorInfo.accountName',
              accountNumber: '$vendorInfo.accountNumber',
              ifscCode: '$vendorInfo.ifscCode',
              profileStatus: '$vendorInfo.profileStatus',
              address: '$vendorInfo.address',
              vendorCode: '$vendorInfo.vendorCode',
              vendorType: '$vendorInfo.vendorType',
              createdBy: '$vendorInfo.createdBy',
              emailStatus: '$vendorInfo.emailStatus',
              smsStatus: '$vendorInfo.smsStatus',
            },
          },
          {
            $match: {
              $or: matchQuery,
            },
          }
        );
      } else if (
        searchedCollection == 'AssociateDriver' &&
        (roleName == 'CORPORATEADMIN' ||
          roleName == 'SUPERADMIN' ||
          roleName == 'VENDOR' ||
          roleName == 'TANENTADMIN')
      ) {
        const cid = req.auth.corporateId;
        let queryString;
        if (roleName == 'VENDOR') {
          queryString = {
            $match: {
              associatedVendorList: {
                $elemMatch: {
                  _id: ObjectId(req.auth.profileId),
                },
              },
            },
          };
        } else {
          queryString = {
            $match: {
              associatedCorporateList: {
                $elemMatch: {
                  _id: ObjectId(cid),
                },
              },
            },
          };
        }
        aggregateCondition.push(
          queryString,
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driver.$id',
              foreignField: '_id',
              as: 'driverInfo',
            },
          },
          {
            $project: {
              driverInfo: { $first: '$driverInfo' },
            },
          },
          {
            $project: {
              _id: '$driverInfo._id',
              tenantId: '$driverInfo.tenantId',
              tenantCode: '$driverInfo.tenantCode',
              tenantName: '$driverInfo.tenantName',
              vendorId: '$driverInfo.vendorId',
              vendorCode: '$driverInfo.vendorCode',
              vendorName: '$driverInfo.vendorName',
              address: '$driverInfo.address',
              mobileNo: '$driverInfo.mobileNo',
              emailId: '$driverInfo.emailId',
              firstName: '$driverInfo.firstName',
              lastName: '$driverInfo.lastName',
              policeVerStatus: '$driverInfo.policeVerStatus',
              dlNumber: '$driverInfo.dlNumber',
              dlValidity: '$driverInfo.dlValidity',
              isPanCard: '$driverInfo.isPanCard',
              status: '$driverInfo.status',
              vehicleAssigned: '$driverInfo.vehicleAssigned',
              isVaccinated: '$driverInfo.isVaccinated',
              photo: '$driverInfo.photo',
              shelterAddress: '$driverInfo.shelterAddress',
              profileStatus: '$driverInfo.profileStatus',
              addressOnLicense: '$driverInfo.addressOnLicense',
              dateofBirth: '$driverInfo.dateofBirth',
              age: '$driverInfo.age',
              gender: '$driverInfo.gender',
              alternateNo: '$driverInfo.alternateNo',
              iDCardIssued: '$driverInfo.iDCardIssued',
              driverInduction: '$driverInfo.driverInduction',
              medicalFitness: '$driverInfo.medicalFitness',
              trainingStatus: '$driverInfo.trainingStatus',
              createdOn: '$driverInfo.createdOn',
              createdBy: '$driverInfo.createdBy',
              updatedOn: '$driverInfo.updatedOn',
              updatedBy: '$driverInfo.updatedBy',
              averageRating: '$driverInfo.averageRating',
              isPresentSameAsPermanent: '$driverInfo.isPresentSameAsPermanent',
              compliancesDto: '$driverInfo.compliancesDto',
              driverInductionDate: '$driverInfo.driverInductionDate',
              loginDetails: '$driverInfo.loginDetails',
            },
          },
          {
            $match: {
              $or: matchQuery,
            },
          }
        );
      } else if (
        searchedCollection == 'AssociateVehicle' &&
        (roleName == 'CORPORATEADMIN' ||
          roleName == 'SUPERADMIN' ||
          roleName == 'VENDOR' ||
          roleName == 'TANENTADMIN')
      ) {
        const cid = req.auth.corporateId;
        let queryString;
        if (roleName == 'VENDOR') {
          queryString = {
            $match: {
              associatedVendorList: {
                $elemMatch: {
                  _id: ObjectId(req.auth.profileId),
                },
              },
            },
          };
        } else {
          queryString = {
            $match: {
              associatedCorporateList: {
                $elemMatch: {
                  _id: ObjectId(cid),
                },
              },
            },
          };
        }

        aggregateCondition.push(
          queryString,
          {
            $lookup: {
              from: 'VehicleReg',
              localField: 'vehicle.$id',
              foreignField: '_id',
              as: 'vehicleInfoAll',
            },
          },
          {
            $project: {
              vehicleInfo: { $first: '$vehicleInfoAll' },
            },
          },
          {
            $project: {
              _id: '$vehicleInfo._id',
              tenantId: '$vehicleInfo.tenantId',
              tenantCode: '$vehicleInfo.tenantCode',
              tenantName: '$vehicleInfo.tenantName',
              vendorId: '$vehicleInfo.vendorId',
              vendorName: '$vehicleInfo.vendorName',
              modelNo: '$vehicleInfo.modelNo',
              vehicleTypeId: '$vehicleInfo.vehicleTypeId',
              vehicleBrand: '$vehicleInfo.vehicleBrand',
              vehicleTypeName: '$vehicleInfo.vehicleTypeName',
              modelName: '$vehicleInfo.modelName',
              fuelType: '$vehicleInfo.fuelType',
              vehicleColor: '$vehicleInfo.vehicleColor',
              ownerName: '$vehicleInfo.ownerName',
              ownerEmail: '$vehicleInfo.ownerEmail',
              ownerMobile: '$vehicleInfo.ownerMobile',
              insuranceTill: '$vehicleInfo.insuranceTill',
              polutionTill: '$vehicleInfo.polutionTill',
              status: '$vehicleInfo.status',
              driverAssignment: '$vehicleInfo.driverAssignment',
              vehicleNumberPlate: '$vehicleInfo.vehicleNumberPlate',
              registrationDate: '$vehicleInfo.registrationDate',
              vehicleInduction: '$vehicleInfo.vehicleInduction',
              registrationExpDate: '$vehicleInfo.registrationExpDate',
              permitExpiryDate: '$vehicleInfo.permitExpiryDate',
              fitnessExpiryDate: '$vehicleInfo.fitnessExpiryDate',
              roadTaxValidityExpiry: '$vehicleInfo.roadTaxValidityExpiry',
              firstAidKitDate: '$vehicleInfo.firstAidKitDate',
              fireExtinguisherDate: '$vehicleInfo.fireExtinguisherDate',
              standardSelect: '$vehicleInfo.standardSelect',
              oweraddress: '$vehicleInfo.oweraddress',
              createdOn: '$vehicleInfo.createdOn',
              updatedOn: '$vehicleInfo.updatedOn',
              createdBy: '$vehicleInfo.createdBy',
              updatedBy: '$vehicleInfo.updatedBy',
              averageRating: '$vehicleInfo.averageRating',
              compliancesDto: '$vehicleInfo.compliancesDto',
              maxCapacityExcludingDriver:
                '$vehicleInfo.maxCapacityExcludingDriver',
              vehicleTypeFormat: '$vehicleInfo.vehicleTypeFormat',
              associatedWithCorporate: '$vehicleInfo.associatedWithCorporate',
              associatedWithVendor: '$vehicleInfo.associatedWithVendor',
            },
          },
          {
            $match: {
              $or: matchQuery,
            },
          }
        );
      }
      const data = await searchedData
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

      return res.status(200).json({
        status: 200,
        message: 'success',
        data: data,
      });
    }
    goForSearch().catch(console.dir);
  } else {
    let matchQuery = [];
    searchCollection[req.body.collection].forEach((ele) => {
      matchQuery.push({
        [ele]: { $regex: '.' + req.body.search + '.', $options: 'i' },
      });
      matchQuery.push({
        [ele]: { $regex: '.' + req.body.search, $options: 'i' },
      });
      matchQuery.push({
        [ele]: { $regex: req.body.search + '.', $options: 'i' },
      });
      matchQuery.push({ [ele]: { $regex: req.body.search, $options: 'i' } });
    });
    async function run() {
      try {
        let collection = req.body.collection;
        const employeeData = database.collection(collection);
        let aggregateCondition = [];
        let condition = [];
        let scon = '$or';
        let tid = req.auth.tanentId;
        let cid = req.body.tanentId ? req.body.tanentId : req.auth.corporateId;
        let cidKey = req.body.tanentId ? 'tanentId' : 'corporateId';
        if (collection == 'EmployeeShift') {
          cidKey = 'corpId';
        }
        const filters = req.body.search || [];
        // const filterData = { $or: matchQuery, $and: [{ corporateId: cid }] };
        const filterData = { $or: matchQuery, $and: [{ [cidKey]: cid }] };
        // if (req.auth.userRole == 'VENDOR') {
        //   filterData['$and'] = [
        //     // { corporateId: cid },
        //     { [cidKey]: cid },
        //     { vendorId: req.auth.profileId },
        //   ];
        // }

        if (collection == 'VehicleType') {
          filterData['$and'] = [
            // { corporateId: cid },
            { tanentId: tid },
          ];
        }
        if (collection == 'GpsProviderDetail') {
          filterData['$and'] = [{}];
        }

        if (collection == 'TanentReg') {
          filterData['$and'] = [{}];
        }

        if (collection == 'EscortReg') {
          filterData['$and'] = [{}];
        }

        const data = await employeeData
          .aggregate([
            {
              $match: filterData,
            },
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
            {
              $match: filterData,
            },
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
    run().catch((error) => {
      return console.log(error);
    });
  }
};

exports.employeeFilter = async (req, res) => {
  const ObjectId = require('mongodb').ObjectId;
  async function run() {
    try {
      //

      //
      let collection = req.body.collection;
      const employeeData = database.collection(collection);
      let aggregateCondition = [];
      let condition = [];
      let scon = '$or';
      let cid = req.body.tanentId ? req.body.tanentId : req.auth.corporateId;
      let roleName = req.auth.userRole;
      let cidKey = req.body.tanentId ? 'tanentId' : 'corporateId';
      if (collection == 'AssociateDriverVendor') {
        cidKey = 'vendorId';
        cid = req.auth.profileId;
      }
      if (collection == 'AssociateVehicleVendor') {
        cidKey = 'vendorId';
        cid = req.auth.profileId;
      }
      if (collection == 'EmployeeShift') {
        cidKey = 'corpId';
      } else if (collection == 'AssociateVendor') {
        aggregateCondition.push(
          {
            $lookup: {
              from: 'VendorReg',
              localField: 'vendor.$id',
              foreignField: '_id',
              as: 'vendorInfo',
            },
          },
          {
            $project: {
              _id: '$_id',
              vendorId: '$vendorId',
              vendorName: '$vendorName',
              corporateId: '$corporateId',
              corporateName: '$corporateName',
              status: '$status',
              createdOn: '$createdOn',
              updateOn: '$updateOn',
              vendorInfo: { $first: '$vendorInfo' },
            },
          },
          {
            $project: {
              _id: '$_id',
              vendorId: '$vendorId',
              vendorName: '$vendorName',
              corporateId: '$corporateId',
              corporateName: '$corporateName',
              status: '$status',
              createdOn: '$createdOn',
              updateOn: '$updateOn',
              tenantId: '$vendorInfo.tenantId',
              mobileNo: '$vendorInfo.mobileNo',
              emailId: '$vendorInfo.emailId',
              contactPersonFirstName: '$vendorInfo.contactPersonFirstName',
              contactPersonLastName: '$vendorInfo.contactPersonLastName',
              companyPAN: '$vendorInfo.companyPAN',
              accountName: '$vendorInfo.accountName',
              accountNumber: '$vendorInfo.accountNumber',
              ifscCode: '$vendorInfo.ifscCode',
              profileStatus: '$vendorInfo.profileStatus',
              address: '$vendorInfo.address',
              vendorCode: '$vendorInfo.vendorCode',
              vendorType: '$vendorInfo.vendorType',
              createdBy: '$vendorInfo.createdBy',
              emailStatus: '$vendorInfo.emailStatus',
              smsStatus: '$vendorInfo.smsStatus',
            },
          }
        );
      } else if (collection == 'AssociateDriverVendor') {
        aggregateCondition.push(
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driver.$id',
              foreignField: '_id',
              as: 'driverInfo',
            },
          },
          {
            $project: {
              //_id: 1,
              driverId: 1,
              corporateId: 1,
              vendorId: 1,
              corporateName: 1,
              status: 1,
              createdOn: 1,
              updatedOn: 1,
              createdBy: 1,
              updatedBy: 1,
              driverInfo: { $first: '$driverInfo' },
            },
          },
          {
            $project: {
              // _id: 1,
              _id: '$driverInfo._id',
              driverId: 1,
              vendorId: 1,
              corporateId: 1,
              corporateName: 1,
              status: 1,
              createdOn: 1,
              updatedOn: 1,
              createdBy: 1,
              updatedBy: 1,
              tenantId: '$driverInfo.tenantId',
              tenantCode: '$driverInfo.tenantCode',
              tenantName: '$driverInfo.tenantName',
              vendorCode: '$driverInfo.vendorCode',
              vendorName: '$driverInfo.vendorName',
              address: '$driverInfo.address',
              mobileNo: '$driverInfo.mobileNo',
              emailId: '$driverInfo.emailId',
              firstName: '$driverInfo.firstName',
              lastName: '$driverInfo.lastName',
              policeVerStatus: '$driverInfo.policeVerStatus',
              dlNumber: '$driverInfo.dlNumber',
              dlValidity: '$driverInfo.dlValidity',
              isPanCard: '$driverInfo.isPanCard',
              status: '$driverInfo.status',
              vehicleAssigned: '$driverInfo.vehicleAssigned',
              isVaccinated: '$driverInfo.isVaccinated',
              photo: '$driverInfo.photo',
              shelterAddress: '$driverInfo.shelterAddress',
              corporateId: '$driverInfo.corporateId',
              profileStatus: '$driverInfo.profileStatus',
              addressOnLicense: '$driverInfo.addressOnLicense',
              dateofBirth: '$driverInfo.dateofBirth',
              age: '$driverInfo.age',
              gender: '$driverInfo.gender',
              alternateNo: '$driverInfo.alternateNo',
              iDCardIssued: '$driverInfo.iDCardIssued',
              driverInduction: '$driverInfo.driverInduction',
              medicalFitness: '$driverInfo.medicalFitness',
              trainingStatus: '$driverInfo.trainingStatus',
              createdOn: '$driverInfo.createdOn',
              createdBy: '$driverInfo.createdBy',
              updatedOn: '$driverInfo.updatedOn',
              updatedBy: '$driverInfo.updatedBy',
              averageRating: '$driverInfo.averageRating',
              isPresentSameAsPermanent: '$driverInfo.isPresentSameAsPermanent',
              compliancesDto: '$driverInfo.compliancesDto',
              driverInductionDate: '$driverInfo.driverInductionDate',
              _class: 'com.reg.user.dto.DriverRegDto',
            },
          }
        );
      } else if (collection == 'VehicleType') {
        cidKey = 'tanentId';
        cid = req.auth.tanentId;
      } else if (
        collection == 'vehicleDriverMappingDto' &&
        (roleName == 'CORPORATEADMIN' ||
          roleName == 'SUPERADMIN' ||
          roleName == 'TANENTADMIN' ||
          roleName == 'VENDOR')
      ) {
        aggregateCondition.push(
          {
            $addFields: {
              vehicleObjectId: {
                $toObjectId: '$vehicleId',
              },
              driverObjectId: {
                $toObjectId: '$driverId',
              },
            },
          },
          {
            $lookup: {
              from: 'VehicleReg',
              localField: 'vehicleObjectId',
              foreignField: '_id',
              as: 'vechileDetails',
            },
          },
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driverObjectId',
              foreignField: '_id',
              as: 'driverDetails',
            },
          },
          {
            $unwind: {
              path: '$vechileDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: '$driverDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              vehicleBrand: '$vechileDetails.vehicleBrand',
              vehicleNumberPlate: '$vechileDetails.vehicleNumberPlate',
              vendorId: '$vechileDetails.vendorId',
              vehicleTypeId: '$vechileDetails.vehicleTypeId',
              status: 1,
              createdBy: '$vechileDetails.createdBy',
              createdOn: '$vechileDetails.createdOn',
              updatedBy: '$vechileDetails.updatedBy',
              updatedOn: '$vechileDetails.updatedOn',
              modelName: '$vechileDetails.modelNo',
              fuelType: '$vechileDetails.fuelType',
              corporateId: '$vechileDetails.corporateId',
              driverFirstName: '$driverDetails.firstName',
              driverLastName: '$driverDetails.lastName',
              driverMobileNo: '$driverDetails.mobileNo',
              driverEmail: '$driverDetails.emailId',
            },
          },
          {
            $addFields: {
              vendorObjectId: {
                $toObjectId: '$vendorId',
              },
              vehicleTypeIdObjectId: {
                $toObjectId: '$vehicleTypeId',
              },
              driverFullName: {
                $concat: ['$driverFirstName', ' ', '$driverLastName'],
              },
            },
          },
          {
            $lookup: {
              from: 'VendorReg',
              localField: 'vendorObjectId',
              foreignField: '_id',
              as: 'vendorDetails',
            },
          },
          {
            $unwind: {
              path: '$vendorDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'VehicleType',
              localField: 'vehicleTypeIdObjectId',
              foreignField: '_id',
              as: 'vehicleTypeDeatils',
            },
          },
          {
            $unwind: {
              path: '$vehicleTypeDeatils',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              vehicleBrand: 1,
              vehicleNumberPlate: 1,
              status: 1,
              createdBy: 1,
              createdOn: 1,
              updatedBy: 1,
              updatedOn: 1,
              modelName: 1,
              fuelType: 1,
              corporateId: 1,
              driverMobileNo: 1,
              driverEmail: 1,
              driverFullName: 1,
              vendorName: '$vendorDetails.vendorName',
              vehicleTypeName: '$vehicleTypeDeatils.vehicleType',
            },
          },
          {
            $match: {
              corporateId: cid,
            },
          }
        );
      } else if (
        collection == 'AssociateDriver' &&
        (roleName == 'CORPORATEADMIN' ||
          roleName == 'SUPERADMIN' ||
          roleName == 'TANENTADMIN')
      ) {
        aggregateCondition.push(
          {
            $match: {
              associatedCorporateList: {
                $elemMatch: {
                  _id: ObjectId(cid),
                },
              },
            },
          },
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driver.$id',
              foreignField: '_id',
              as: 'driverInfo',
            },
          },
          {
            $project: {
              driverInfo: { $first: '$driverInfo' },
            },
          },
          {
            $project: {
              _id: '$driverInfo._id',
              tenantId: '$driverInfo.tenantId',
              tenantCode: '$driverInfo.tenantCode',
              tenantName: '$driverInfo.tenantName',
              vendorId: '$driverInfo.vendorId',
              vendorCode: '$driverInfo.vendorCode',
              vendorName: '$driverInfo.vendorName',
              address: '$driverInfo.address',
              mobileNo: '$driverInfo.mobileNo',
              emailId: '$driverInfo.emailId',
              firstName: '$driverInfo.firstName',
              lastName: '$driverInfo.lastName',
              policeVerStatus: '$driverInfo.policeVerStatus',
              dlNumber: '$driverInfo.dlNumber',
              dlValidity: '$driverInfo.dlValidity',
              isPanCard: '$driverInfo.isPanCard',
              status: '$driverInfo.status',
              vehicleAssigned: '$driverInfo.vehicleAssigned',
              isVaccinated: '$driverInfo.isVaccinated',
              photo: '$driverInfo.photo',
              shelterAddress: '$driverInfo.shelterAddress',
              profileStatus: '$driverInfo.profileStatus',
              addressOnLicense: '$driverInfo.addressOnLicense',
              dateofBirth: '$driverInfo.dateofBirth',
              age: '$driverInfo.age',
              gender: '$driverInfo.gender',
              alternateNo: '$driverInfo.alternateNo',
              iDCardIssued: '$driverInfo.iDCardIssued',
              driverInduction: '$driverInfo.driverInduction',
              medicalFitness: '$driverInfo.medicalFitness',
              trainingStatus: '$driverInfo.trainingStatus',
              createdOn: '$driverInfo.createdOn',
              createdBy: '$driverInfo.createdBy',
              updatedOn: '$driverInfo.updatedOn',
              updatedBy: '$driverInfo.updatedBy',
              averageRating: '$driverInfo.averageRating',
              isPresentSameAsPermanent: '$driverInfo.isPresentSameAsPermanent',
              compliancesDto: '$driverInfo.compliancesDto',
              driverInductionDate: '$driverInfo.driverInductionDate',
              loginDetails: '$driverInfo.loginDetails',
            },
          }
        );
      } else if (collection == 'AssociateDriver' && roleName == 'VENDOR') {
        aggregateCondition.push(
          {
            $match: {
              associatedVendorList: {
                $elemMatch: {
                  _id: ObjectId(req.auth.profileId),
                },
              },
            },
          },
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driver.$id',
              foreignField: '_id',
              as: 'driverInfo',
            },
          },
          {
            $project: {
              driverInfo: { $first: '$driverInfo' },
            },
          },
          {
            $project: {
              _id: '$driverInfo._id',
              tenantId: '$driverInfo.tenantId',
              tenantCode: '$driverInfo.tenantCode',
              tenantName: '$driverInfo.tenantName',
              vendorId: '$driverInfo.vendorId',
              vendorCode: '$driverInfo.vendorCode',
              vendorName: '$driverInfo.vendorName',
              address: '$driverInfo.address',
              mobileNo: '$driverInfo.mobileNo',
              emailId: '$driverInfo.emailId',
              firstName: '$driverInfo.firstName',
              lastName: '$driverInfo.lastName',
              policeVerStatus: '$driverInfo.policeVerStatus',
              dlNumber: '$driverInfo.dlNumber',
              dlValidity: '$driverInfo.dlValidity',
              isPanCard: '$driverInfo.isPanCard',
              status: '$driverInfo.status',
              vehicleAssigned: '$driverInfo.vehicleAssigned',
              isVaccinated: '$driverInfo.isVaccinated',
              photo: '$driverInfo.photo',
              shelterAddress: '$driverInfo.shelterAddress',
              profileStatus: '$driverInfo.profileStatus',
              addressOnLicense: '$driverInfo.addressOnLicense',
              dateofBirth: '$driverInfo.dateofBirth',
              age: '$driverInfo.age',
              gender: '$driverInfo.gender',
              alternateNo: '$driverInfo.alternateNo',
              iDCardIssued: '$driverInfo.iDCardIssued',
              driverInduction: '$driverInfo.driverInduction',
              medicalFitness: '$driverInfo.medicalFitness',
              trainingStatus: '$driverInfo.trainingStatus',
              createdOn: '$driverInfo.createdOn',
              createdBy: '$driverInfo.createdBy',
              updatedOn: '$driverInfo.updatedOn',
              updatedBy: '$driverInfo.updatedBy',
              averageRating: '$driverInfo.averageRating',
              isPresentSameAsPermanent: '$driverInfo.isPresentSameAsPermanent',
              compliancesDto: '$driverInfo.compliancesDto',
              driverInductionDate: '$driverInfo.driverInductionDate',
            },
          }
        );
      } else if (
        collection == 'AssociateVehicle' &&
        (roleName == 'CORPORATEADMIN' ||
          roleName == 'SUPERADMIN' ||
          roleName == 'TANENTADMIN')
      ) {
        aggregateCondition.push(
          {
            $match: {
              associatedCorporateList: {
                $elemMatch: {
                  _id: ObjectId(cid),
                },
              },
            },
          },
          {
            $lookup: {
              from: 'VehicleReg',
              localField: 'vehicle.$id',
              foreignField: '_id',
              as: 'vehicleInfoAll',
            },
          },
          {
            $project: {
              vehicleInfo: { $first: '$vehicleInfoAll' },
            },
          },
          {
            $project: {
              _id: '$vehicleInfo._id',
              tenantId: '$vehicleInfo.tenantId',
              tenantCode: '$vehicleInfo.tenantCode',
              tenantName: '$vehicleInfo.tenantName',
              vendorId: '$vehicleInfo.vendorId',
              vendorName: '$vehicleInfo.vendorName',
              modelNo: '$vehicleInfo.modelNo',
              vehicleTypeId: '$vehicleInfo.vehicleTypeId',
              vehicleBrand: '$vehicleInfo.vehicleBrand',
              vehicleTypeName: '$vehicleInfo.vehicleTypeName',
              modelName: '$vehicleInfo.modelName',
              fuelType: '$vehicleInfo.fuelType',
              vehicleColor: '$vehicleInfo.vehicleColor',
              ownerName: '$vehicleInfo.ownerName',
              ownerEmail: '$vehicleInfo.ownerEmail',
              ownerMobile: '$vehicleInfo.ownerMobile',
              insuranceTill: '$vehicleInfo.insuranceTill',
              polutionTill: '$vehicleInfo.polutionTill',
              status: '$vehicleInfo.status',
              driverAssignment: '$vehicleInfo.driverAssignment',
              vehicleNumberPlate: '$vehicleInfo.vehicleNumberPlate',
              registrationDate: '$vehicleInfo.registrationDate',
              vehicleInduction: '$vehicleInfo.vehicleInduction',
              registrationExpDate: '$vehicleInfo.registrationExpDate',
              permitExpiryDate: '$vehicleInfo.permitExpiryDate',
              fitnessExpiryDate: '$vehicleInfo.fitnessExpiryDate',
              roadTaxValidityExpiry: '$vehicleInfo.roadTaxValidityExpiry',
              firstAidKitDate: '$vehicleInfo.firstAidKitDate',
              fireExtinguisherDate: '$vehicleInfo.fireExtinguisherDate',
              standardSelect: '$vehicleInfo.standardSelect',
              oweraddress: '$vehicleInfo.oweraddress',
              createdOn: '$vehicleInfo.createdOn',
              updatedOn: '$vehicleInfo.updatedOn',
              createdBy: '$vehicleInfo.createdBy',
              updatedBy: '$vehicleInfo.updatedBy',
              averageRating: '$vehicleInfo.averageRating',
              compliancesDto: '$vehicleInfo.compliancesDto',
              maxCapacityExcludingDriver:
                '$vehicleInfo.maxCapacityExcludingDriver',
              vehicleTypeFormat: '$vehicleInfo.vehicleTypeFormat',
              associatedWithCorporate: '$vehicleInfo.associatedWithCorporate',
              associatedWithVendor: '$vehicleInfo.associatedWithVendor',
            },
          }
        );
      } else if (collection == 'AssociateVehicle' && roleName == 'VENDOR') {
        aggregateCondition.push(
          {
            $match: {
              associatedVendorList: {
                $elemMatch: {
                  _id: ObjectId(req.auth.profileId),
                },
              },
            },
          },
          {
            $lookup: {
              from: 'VehicleReg',
              localField: 'vehicle.$id',
              foreignField: '_id',
              as: 'vehicleInfoAll',
            },
          },
          {
            $project: {
              vehicleInfo: { $first: '$vehicleInfoAll' },
            },
          },
          {
            $project: {
              _id: '$vehicleInfo._id',
              tenantId: '$vehicleInfo.tenantId',
              tenantCode: '$vehicleInfo.tenantCode',
              tenantName: '$vehicleInfo.tenantName',
              vendorId: '$vehicleInfo.vendorId',
              vendorName: '$vehicleInfo.vendorName',
              modelNo: '$vehicleInfo.modelNo',
              vehicleTypeId: '$vehicleInfo.vehicleTypeId',
              vehicleBrand: '$vehicleInfo.vehicleBrand',
              vehicleTypeName: '$vehicleInfo.vehicleTypeName',
              modelName: '$vehicleInfo.modelName',
              fuelType: '$vehicleInfo.fuelType',
              vehicleColor: '$vehicleInfo.vehicleColor',
              ownerName: '$vehicleInfo.ownerName',
              ownerEmail: '$vehicleInfo.ownerEmail',
              ownerMobile: '$vehicleInfo.ownerMobile',
              insuranceTill: '$vehicleInfo.insuranceTill',
              polutionTill: '$vehicleInfo.polutionTill',
              status: '$vehicleInfo.status',
              driverAssignment: '$vehicleInfo.driverAssignment',
              vehicleNumberPlate: '$vehicleInfo.vehicleNumberPlate',
              registrationDate: '$vehicleInfo.registrationDate',
              vehicleInduction: '$vehicleInfo.vehicleInduction',
              registrationExpDate: '$vehicleInfo.registrationExpDate',
              permitExpiryDate: '$vehicleInfo.permitExpiryDate',
              fitnessExpiryDate: '$vehicleInfo.fitnessExpiryDate',
              roadTaxValidityExpiry: '$vehicleInfo.roadTaxValidityExpiry',
              firstAidKitDate: '$vehicleInfo.firstAidKitDate',
              fireExtinguisherDate: '$vehicleInfo.fireExtinguisherDate',
              standardSelect: '$vehicleInfo.standardSelect',
              oweraddress: '$vehicleInfo.oweraddress',
              createdOn: '$vehicleInfo.createdOn',
              updatedOn: '$vehicleInfo.updatedOn',
              createdBy: '$vehicleInfo.createdBy',
              updatedBy: '$vehicleInfo.updatedBy',
              averageRating: '$vehicleInfo.averageRating',
              compliancesDto: '$vehicleInfo.compliancesDto',
              maxCapacityExcludingDriver:
                '$vehicleInfo.maxCapacityExcludingDriver',
              vehicleTypeFormat: '$vehicleInfo.vehicleTypeFormat',
              associatedWithCorporate: '$vehicleInfo.associatedWithCorporate',
              associatedWithVendor: '$vehicleInfo.associatedWithVendor',
            },
          }
        );
      } else if (collection == 'AssociateDriver' && roleName == 'SUPERADMIN') {
        aggregateCondition.push(
          {
            $match: {
              associatedVendorList: {
                $elemMatch: {
                  _id: ObjectId(req.auth.profileId),
                },
              },
            },
          },
          {
            $lookup: {
              from: 'DriverReg',
              localField: 'driver.$id',
              foreignField: '_id',
              as: 'driverInfo',
            },
          },
          {
            $project: {
              driverInfo: { $first: '$driverInfo' },
            },
          },
          {
            $project: {
              _id: '$driverInfo._id',
              tenantId: '$driverInfo.tenantId',
              tenantCode: '$driverInfo.tenantCode',
              tenantName: '$driverInfo.tenantName',
              vendorId: '$driverInfo.vendorId',
              vendorCode: '$driverInfo.vendorCode',
              vendorName: '$driverInfo.vendorName',
              address: '$driverInfo.address',
              mobileNo: '$driverInfo.mobileNo',
              emailId: '$driverInfo.emailId',
              firstName: '$driverInfo.firstName',
              lastName: '$driverInfo.lastName',
              policeVerStatus: '$driverInfo.policeVerStatus',
              dlNumber: '$driverInfo.dlNumber',
              dlValidity: '$driverInfo.dlValidity',
              isPanCard: '$driverInfo.isPanCard',
              status: '$driverInfo.status',
              vehicleAssigned: '$driverInfo.vehicleAssigned',
              isVaccinated: '$driverInfo.isVaccinated',
              photo: '$driverInfo.photo',
              shelterAddress: '$driverInfo.shelterAddress',
              profileStatus: '$driverInfo.profileStatus',
              addressOnLicense: '$driverInfo.addressOnLicense',
              dateofBirth: '$driverInfo.dateofBirth',
              age: '$driverInfo.age',
              gender: '$driverInfo.gender',
              alternateNo: '$driverInfo.alternateNo',
              iDCardIssued: '$driverInfo.iDCardIssued',
              driverInduction: '$driverInfo.driverInduction',
              medicalFitness: '$driverInfo.medicalFitness',
              trainingStatus: '$driverInfo.trainingStatus',
              createdOn: '$driverInfo.createdOn',
              createdBy: '$driverInfo.createdBy',
              updatedOn: '$driverInfo.updatedOn',
              updatedBy: '$driverInfo.updatedBy',
              averageRating: '$driverInfo.averageRating',
              isPresentSameAsPermanent: '$driverInfo.isPresentSameAsPermanent',
              compliancesDto: '$driverInfo.compliancesDto',
              driverInductionDate: '$driverInfo.driverInductionDate',
            },
          }
        );
      }

      const filters = req.body.filters || [];
      let filterData;
      if (
        filters.length > 0 &&
        ((collection == 'AssociateVehicle' &&
          (roleName == 'CORPORATEADMIN' ||
            roleName == 'SUPERADMIN' ||
            roleName == 'TANENTADMIN')) ||
          (collection == 'AssociateDriver' &&
            (roleName == 'CORPORATEADMIN' || roleName == 'SUPERADMIN')) ||
          (collection == 'AssociateDriver' && roleName == 'VENDOR') ||
          (collection == 'AssociateVehicle' && roleName == 'VENDOR'))
      ) {
        filterData = { $and: [] };
      } else {
        filterData = { $and: [{ [cidKey]: cid }] };
      }

      if (
        req.auth.userRole == 'VENDOR' &&
        (collection == 'DriverReg' || collection == 'VehicleReg')
      ) {
        filterData['$and'] = [
          { [cidKey]: cid },
          { vendorId: req.auth.profileId },
        ];
      }
      const orData = filters.filter(
        (ele) =>
          ele.fieldOperator == '$or' &&
          ele.field !== 'fromDate' &&
          ele.field !== 'toDate'
      );
      const andData = filters.filter(
        (ele) =>
          ele.fieldOperator == '$and' &&
          ele.field !== 'fromDate' &&
          ele.field !== 'toDate'
      );
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
      if (
        collection != 'TanentReg' &&
        collection != 'AssociateVehicle' &&
        collection != 'AssociateDriver'
      ) {
        aggregateCondition.push({
          $match: filterData,
        });
      }
      if (
        filters.length > 0 &&
        ((collection == 'AssociateVehicle' &&
          (roleName == 'CORPORATEADMIN' ||
            roleName == 'SUPERADMIN' ||
            roleName == 'TANENTADMIN')) ||
          (collection == 'AssociateDriver' &&
            (roleName == 'CORPORATEADMIN' || roleName == 'SUPERADMIN')) ||
          (collection == 'AssociateDriver' && roleName == 'VENDOR') ||
          (collection == 'AssociateVehicle' && roleName == 'VENDOR'))
      ) {
        aggregateCondition.push({
          $match: filterData,
        });
      }

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
