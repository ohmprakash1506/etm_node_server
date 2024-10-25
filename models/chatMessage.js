const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const chatMessageSchema = new Schema(
  {
    tripId: String,
    employeeName: String,
    employeeId: String,
    mobileNo: String,
    gender: String,
    message: String,
    timeStamp: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'chatMessages' }
);

chatMessageSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ChatMessage = model('ChatMessage', chatMessageSchema);

module.exports = { ChatMessages: ChatMessage };
