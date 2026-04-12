const mongoose = require('mongoose');

const trackedCompetitionSchema = new mongoose.Schema(
  {
    targetId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ownerId: {
      type: String,
      required: true
    },
    ownerEmail: {
      type: String,
      default: null,
      trim: true
    },
    ownerName: {
      type: String,
      default: null,
      trim: true
    },
    title: {
      type: String,
      default: null,
      trim: true
    },
    city: {
      type: String,
      default: null,
      trim: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    deadline: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'FINALIZED', 'DELETED'],
      default: 'ACTIVE',
      index: true
    },
    lastReminderSentAt: {
      type: Date,
      default: null
    },
    nextReminderAt: {
      type: Date,
      default: null
    },
    registrationsClosedAt: {
      type: Date,
      default: null
    },
    finalizedAt: {
      type: Date,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('TrackedCompetition', trackedCompetitionSchema);
