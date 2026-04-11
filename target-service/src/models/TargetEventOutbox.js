const mongoose = require('mongoose');

const targetEventOutboxSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['target.created'],
      required: true,
      index: true
    },
    targetId: {
      type: String,
      required: true,
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastError: {
      type: String,
      default: null
    },
    publishedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

targetEventOutboxSchema.index({ eventType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('TargetEventOutbox', targetEventOutboxSchema);
