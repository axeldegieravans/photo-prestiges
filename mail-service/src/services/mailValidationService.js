const validateEmailLike = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.includes('@')) {
    const error = new Error(`${fieldName} must be a valid email address`);
    error.statusCode = 400;
    throw error;
  }
};

const validateNonEmptyString = (value, fieldName) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
};

const validateTargetResultsPayload = (payload) => {
  const { target, owner, participants } = payload || {};

  if (!target || typeof target !== 'object') {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  if (!owner || typeof owner !== 'object' || !owner.email) {
    const error = new Error('owner with email is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(participants)) {
    const error = new Error('participants must be an array');
    error.statusCode = 400;
    throw error;
  }
};

const validateReminderPayload = (payload) => {
  const { target, recipients } = payload || {};

  if (!target || typeof target !== 'object') {
    const error = new Error('target is required');
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(recipients)) {
    const error = new Error('recipients must be an array');
    error.statusCode = 400;
    throw error;
  }
};

module.exports = {
  validateEmailLike,
  validateNonEmptyString,
  validateTargetResultsPayload,
  validateReminderPayload
};
