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

const fetchMyRegistrations = async (authHeader) => {
  const registerServiceUrl = process.env.REGISTER_SERVICE_URL;

  if (!registerServiceUrl) {
    const error = new Error('REGISTER_SERVICE_URL is not configured');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetchWithRetry(
    `${registerServiceUrl}/api/registrations/me?page=1&limit=100`,
    {
      headers: {
        Authorization: authHeader
      }
    }
  );

  const result = await safeParseJson(response);

  if (response.status === 401) {
    const error = new Error('Unauthorized while validating registration');
    error.statusCode = 401;
    throw error;
  }

  if (response.status === 403) {
    const error = new Error('Only participants can submit for targets');
    error.statusCode = 403;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Could not validate registration');
    error.statusCode = 503;
    throw error;
  }

  if (!result || !Array.isArray(result.items)) {
    const error = new Error('Invalid register-service response');
    error.statusCode = 503;
    throw error;
  }

  return result.items;
};

const validateSubmissionRules = async ({
  targetId,
  participantId,
  authHeader
}) => {
  const target = await fetchTargetById(targetId);

  if (String(target.ownerId) === String(participantId)) {
    const error = new Error('You cannot submit a photo for your own target');
    error.statusCode = 403;
    throw error;
  }

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

  const registrations = await fetchMyRegistrations(authHeader);
  const isRegistered = registrations.some(
    (registration) => String(registration.targetId) === String(targetId)
  );

  if (!isRegistered) {
    const error = new Error(
      'You must be registered for this target before submitting'
    );
    error.statusCode = 403;
    throw error;
  }

  return target;
};

module.exports = {
  assertParticipant,
  assertOwner,
  fetchTargetById,
  validateSubmissionRules
};
