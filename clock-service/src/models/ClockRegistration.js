const mongoose = require('mongoose');

const clockRegistrationSchema = new mongoose.Schema(
  {
    targetId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    participantId: {
      type: String,
      required: true,
      trim: true
    },
    participantEmail: {
      type: String,
      default: null,
      trim: true
    },
    participantName: {
      type: String,
      default: null,
      trim: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

clockRegistrationSchema.index(
  { targetId: 1, participantId: 1 },
  { unique: true }
);

module.exports = mongoose.model('ClockRegistration', clockRegistrationSchema);
