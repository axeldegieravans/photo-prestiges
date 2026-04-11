const mongoose = require('mongoose');
const { safeParseJson, fetchWithRetry } = require('../utils/httpClient');
const { createHttpError } = require('../utils/httpError');

const PARTICIPANT = 'PARTICIPANT';
const OWNER = 'OWNER';

const assertParticipant = (user) => {
  if (!user || user.role !== PARTICIPANT) {
    throw createHttpError(403, 'Only participants can perform this action');
  }
};

const assertOwner = (user) => {
  if (!user || user.role !== OWNER) {
    throw createHttpError(403, 'Only owners can perform this action');
  }
};

const validateRegistrationId = (registrationId) => {
  if (!mongoose.Types.ObjectId.isValid(registrationId)) {
    throw createHttpError(400, 'Invalid registration id');
  }
};

const fetchTargetById = async (targetId) => {
  const targetServiceUrl = process.env.TARGET_SERVICE_URL;

  if (!targetServiceUrl) {
    throw createHttpError(500, 'TARGET_SERVICE_URL is not configured');
  }

  const response = await fetchWithRetry(`${targetServiceUrl}/api/targets/${targetId}`);
  const result = await safeParseJson(response);

  if (response.status === 404) {
    throw createHttpError(404, 'Target not found');
  }

  if (!response.ok) {
    throw createHttpError(503, 'Could not validate target');
  }

  if (!result || !result.data) {
    throw createHttpError(503, 'Invalid target-service response');
  }

  return result.data;
};

const assertTargetOwner = (target, user) => {
  if (!target || !target.ownerId) {
    throw createHttpError(503, 'Target owner could not be determined');
  }

  if (String(target.ownerId) !== String(user.userId)) {
    throw createHttpError(403, 'You can only access registrations for your own target');
  }
};

const validateTargetForRegistration = async (targetId) => {
  const target = await fetchTargetById(targetId);

  if (target.status !== 'OPEN') {
    throw createHttpError(403, 'Target is closed');
  }

  const deadline = new Date(target.deadline);

  if (Number.isNaN(deadline.getTime())) {
    throw createHttpError(500, 'Target has an invalid deadline');
  }

  if (deadline <= new Date()) {
    throw createHttpError(403, 'Target deadline has already passed');
  }

  return target;
};

module.exports = {
  assertParticipant,
  assertOwner,
  validateRegistrationId,
  fetchTargetById,
  assertTargetOwner,
  validateTargetForRegistration
};
