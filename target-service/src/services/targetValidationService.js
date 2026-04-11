const mongoose = require('mongoose');
const Target = require('../models/Target');

const OWNER = 'OWNER';
const PARTICIPANT = 'PARTICIPANT';

const assertOwner = (user) => {
  if (!user || user.role !== OWNER) {
    const error = new Error('Only owners can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const assertParticipant = (user) => {
  if (!user || user.role !== PARTICIPANT) {
    const error = new Error('Only participants can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const assertTargetOwnership = (target, user) => {
  if (String(target.ownerId) !== String(user.userId)) {
    const error = new Error('You can only manage your own target');
    error.statusCode = 403;
    throw error;
  }
};

const validateTargetId = (targetId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    const error = new Error('Invalid target id');
    error.statusCode = 400;
    throw error;
  }
};

const getTargetOrThrow = async (targetId) => {
  validateTargetId(targetId);

  const target = await Target.findById(targetId);

  if (!target) {
    const error = new Error('Target not found');
    error.statusCode = 404;
    throw error;
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
      const error = new Error('latitude must be a number between -90 and 90');
      error.statusCode = 400;
      throw error;
    }
  }

  if (longitude !== undefined && longitude !== null && longitude !== '') {
    if (
      Number.isNaN(Number(longitude)) ||
      Number(longitude) < -180 ||
      Number(longitude) > 180
    ) {
      const error = new Error('longitude must be a number between -180 and 180');
      error.statusCode = 400;
      throw error;
    }
  }
};

const validateTargetStatus = (status) => {
  if (!status) {
    return undefined;
  }

  const normalizedStatus = String(status).toUpperCase();

  if (!['OPEN', 'CLOSED'].includes(normalizedStatus)) {
    const error = new Error('status must be OPEN or CLOSED');
    error.statusCode = 400;
    throw error;
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
