const mongoose = require('mongoose');

const targetRegistrationStateSchema = new mongoose.Schema(
  {
    targetId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    registrationsOpen: {
      type: Boolean,
      default: true
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'TargetRegistrationState',
  targetRegistrationStateSchema
);