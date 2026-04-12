const mongoose = require('mongoose');

const clockSubmissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
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
    similarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

clockSubmissionSchema.index({ targetId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model('ClockSubmission', clockSubmissionSchema);
