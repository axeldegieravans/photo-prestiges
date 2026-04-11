const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    radiusMeters: {
      type: Number,
      required: true,
      min: 1
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
    ownerId: {
      type: String,
      required: true,
      trim: true
    },
    deadline: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN'
    },
    winnerParticipantId: {
      type: String,
      default: null,
      trim: true
    },
    winnerSubmissionId: {
      type: String,
      default: null,
      trim: true
    },
    winningScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100
    },
    winningSubmittedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    lastReminderSentAt: {
      type: Date,
      default: null
    },
    thumbsUpCount: {
      type: Number,
      default: 0
    },
    thumbsDownCount: {
      type: Number,
      default: 0
    },
  },
  {
    timestamps: true
  }
);

targetSchema.index({ city: 1, status: 1, createdAt: -1 });
targetSchema.index({ ownerId: 1, createdAt: -1 });
targetSchema.index({ deadline: 1 });

module.exports = mongoose.model('Target', targetSchema);