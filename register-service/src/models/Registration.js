const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    targetId: {
      type: String,
      required: true,
      trim: true
    },
    participantId: {
      type: String,
      required: true,
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

registrationSchema.index({ targetId: 1, participantId: 1 }, { unique: true });
registrationSchema.index({ participantId: 1, createdAt: -1 });
registrationSchema.index({ targetId: 1, createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);