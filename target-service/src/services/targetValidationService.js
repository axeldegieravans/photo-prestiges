const mongoose = require('mongoose');
const Target = require('../models/Target');
const { createHttpError } = require('../utils/httpError');

const OWNER = 'OWNER';
const PARTICIPANT = 'PARTICIPANT';

const assertOwner = (user) => {
  if (!user || user.role !== OWNER) {
    throw createHttpError(403, 'Only owners can perform this action');
  }
};

const assertParticipant = (user) => {
  if (!user || user.role !== PARTICIPANT) {
    throw createHttpError(403, 'Only participants can perform this action');
  }
};

const assertTargetOwnership = (target, user) => {
  if (String(target.ownerId) !== String(user.userId)) {
    throw createHttpError(403, 'You can only manage your own target');
  }
};

const validateTargetId = (targetId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw createHttpError(400, 'Invalid target id');
  }
};

const getTargetOrThrow = async (targetId) => {
  validateTargetId(targetId);

  const target = await Target.findById(targetId);

  if (!target) {
    throw createHttpError(404, 'Target not found');
  }

  return target;
};

const validateCoordinates = ({ latitude, longitude }) => {
  if (latitude !== undefined && latitude !== null && latitude !== '') {
    if (
      Number.isNaN(Number(latitude)) ||
      Number(latitude) < -90 ||
      Number(latitude) > 90
    ) {
      throw createHttpError(400, 'latitude must be a number between -90 and 90');
    }
  }

  if (longitude !== undefined && longitude !== null && longitude !== '') {
    if (
      Number.isNaN(Number(longitude)) ||
      Number(longitude) < -180 ||
      Number(longitude) > 180
    ) {
      throw createHttpError(400, 'longitude must be a number between -180 and 180');
    }
  }
};

const validateTargetStatus = (status) => {
  if (!status) {
    return undefined;
  }

  const normalizedStatus = String(status).toUpperCase();

  if (!['OPEN', 'CLOSED'].includes(normalizedStatus)) {
    throw createHttpError(400, 'status must be OPEN or CLOSED');
  }

  return normalizedStatus;
};

module.exports = {
  assertOwner,
  assertParticipant,
  assertTargetOwnership,
  validateTargetId,
  getTargetOrThrow,
  validateCoordinates,
  validateTargetStatus
};
