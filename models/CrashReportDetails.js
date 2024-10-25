const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const crashReportDetailSchema = new Schema({
  ipAddress: String,
  deviceType: String,
  oS: String,
  activeStatus: String,
  appVersion: String,
  osVersion: String,
  locationPermission: String,
  batteryOptimisationStatus: Boolean,
  error: String,
  errorInfo: String,
  createdAt: { 
    type: Date,
    default: Date.now 
  },
  updatedAt: { type: Date,
    default: Date.now }
});

crashReportDetailSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
    
const CrashReportDetail = model('CrashReportDetail', crashReportDetailSchema);

exports.CrashReportDetails = CrashReportDetail;