const mongoose = require('mongoose');
const { safeParseJson, fetchWithRetry } = require('../utils/httpClient');

const PARTICIPANT = 'PARTICIPANT';
const OWNER = 'OWNER';

const assertParticipant = (user) => {
  if (!user || user.role !== PARTICIPANT) {
    const error = new Error('Only participants can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const assertOwner = (user) => {
  if (!user || user.role !== OWNER) {
    const error = new Error('Only owners can perform this action');
    error.statusCode = 403;
    throw error;
  }
};

const validateRegistrationId = (registrationId) => {
  if (!mongoose.Types.ObjectId.isValid(registrationId)) {
    const error = new Error('Invalid registration id');
    error.statusCode = 400;
    throw error;
  }
};

const fetchTargetById = async (targetId) => {
  const targetServiceUrl = process.env.TARGET_SERVICE_URL;

  if (!targetServiceUrl) {
    const error = new Error('TARGET_SERVICE_URL is not configured');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetchWithRetry(`${targetServiceUrl}/api/targets/${targetId}`);
  const result = await safeParseJson(response);

  if (response.status === 404) {
    const error = new Error('Target not found');
    error.statusCode = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Could not validate target');
    error.statusCode = 503;
    throw error;
  }

  if (!result || !result.data) {
    const error = new Error('Invalid target-service response');
    error.statusCode = 503;
    throw error;
  }

  return result.data;
};

const assertTargetOwner = (target, user) => {
  if (!target || !target.ownerId) {
    const error = new Error('Target owner could not be determined');
    error.statusCode = 503;
    throw error;
  }

  if (String(target.ownerId) !== String(user.userId)) {
    const error = new Error('You can only access registrations for your own target');
    error.statusCode = 403;
    throw error;
  }
};

const validateTargetForRegistration = async (targetId) => {
  const target = await fetchTargetById(targetId);

  if (target.status !== 'OPEN') {
    const error = new Error('Target is closed');
    error.statusCode = 403;
    throw error;
  }

  const deadline = new Date(target.deadline);

  if (Number.isNaN(deadline.getTime())) {
    const error = new Error('Target has an invalid deadline');
    error.statusCode = 500;
    throw error;
  }

  if (deadline <= new Date()) {
    const error = new Error('Target deadline has already passed');
    error.statusCode = 403;
    throw error;
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
