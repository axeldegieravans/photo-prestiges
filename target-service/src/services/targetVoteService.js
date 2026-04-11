const TargetVote = require('../models/TargetVote');
const {
  assertParticipant,
  getTargetOrThrow
} = require('./targetValidationService');

const formatVoteResponse = (target, myVote) => {
  return {
    message: 'Vote saved successfully',
    data: {
      targetId: target._id,
      myVote,
      thumbsUpCount: target.thumbsUpCount,
      thumbsDownCount: target.thumbsDownCount
    }
  };
};

const voteOnTarget = async ({ targetId, user, vote }) => {
  assertParticipant(user);

  const normalizedVote = String(vote || '').toUpperCase();

  if (!['UP', 'DOWN'].includes(normalizedVote)) {
    const error = new Error('vote must be UP or DOWN');
    error.statusCode = 400;
    throw error;
  }

  const target = await getTargetOrThrow(targetId);

  if (String(target.ownerId) === String(user.userId)) {
    const error = new Error('You cannot vote on your own target');
    error.statusCode = 403;
    throw error;
  }

  const existingVote = await TargetVote.findOne({
    targetId,
    participantId: user.userId
  });

  if (!existingVote) {
    await TargetVote.create({
      targetId,
      participantId: user.userId,
      vote: normalizedVote
    });

    if (normalizedVote === 'UP') {
      target.thumbsUpCount += 1;
    } else {
      target.thumbsDownCount += 1;
    }

    await target.save();

    return formatVoteResponse(target, normalizedVote);
  }

  if (existingVote.vote !== normalizedVote) {
    if (existingVote.vote === 'UP') {
      target.thumbsUpCount = Math.max(target.thumbsUpCount - 1, 0);
    } else {
      target.thumbsDownCount = Math.max(target.thumbsDownCount - 1, 0);
    }

    if (normalizedVote === 'UP') {
      target.thumbsUpCount += 1;
    } else {
      target.thumbsDownCount += 1;
    }

    existingVote.vote = normalizedVote;
    await existingVote.save();
    await target.save();
  }

  return formatVoteResponse(target, normalizedVote);
};

module.exports = {
  voteOnTarget
};
