const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const waitingReportSchema = new Schema({
  driverId: String,
  employeeId: String,
  tripId: String,
  locationReachedTime: String,
  locationExitingTime: String,
  passangerBoarded: Boolean,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

waitingReportSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const WaitingReport = model('WaitingReport', waitingReportSchema);

exports.WaitingReports = WaitingReport;
