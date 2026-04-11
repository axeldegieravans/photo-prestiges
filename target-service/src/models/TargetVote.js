const mongoose = require('mongoose');

const targetVoteSchema = new mongoose.Schema(
  {
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Target',
      required: true,
      index: true
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    vote: {
      type: String,
      enum: ['UP', 'DOWN'],
      required: true
    }
  },
  {
    timestamps: true
  }
);

targetVoteSchema.index({ targetId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model('TargetVote', targetVoteSchema);