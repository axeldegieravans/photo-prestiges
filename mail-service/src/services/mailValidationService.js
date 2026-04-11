const { createHttpError } = require('../utils/httpError');

const validateEmailLike = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.includes('@')) {
    throw createHttpError(400, `${fieldName} must be a valid email address`);
  }
};

const validateNonEmptyString = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw createHttpError(400, `${fieldName} is required`);
  }
};

const validateTargetResultsPayload = (payload) => {
  const { target, owner, participants } = payload || {};

  if (!target || typeof target !== 'object') {
    throw createHttpError(400, 'target is required');
  }

  if (!owner || typeof owner !== 'object' || !owner.email) {
    throw createHttpError(400, 'owner with email is required');
  }

  if (!Array.isArray(participants)) {
    throw createHttpError(400, 'participants must be an array');
  }
};

const validateReminderPayload = (payload) => {
  const { target, recipients } = payload || {};

  if (!target || typeof target !== 'object') {
    throw createHttpError(400, 'target is required');
  }

  if (!Array.isArray(recipients)) {
    throw createHttpError(400, 'recipients must be an array');
  }
};

module.exports = {
  validateEmailLike,
  validateNonEmptyString,
  validateTargetResultsPayload,
  validateReminderPayload
};
