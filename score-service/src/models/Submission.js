const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
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
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    imageFilename: {
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
    analysisProvider: {
      type: String,
      default: 'MOCK'
    },
    analysisSummary: {
      type: String,
      default: 'Mock similarity analysis'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['SCORED'],
      default: 'SCORED'
    }
  },
  {
    timestamps: true
  }
);

submissionSchema.index({ targetId: 1, participantId: 1 }, { unique: true });
submissionSchema.index({ participantId: 1, createdAt: -1 });
submissionSchema.index({ targetId: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);