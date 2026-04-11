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

const fetchMyRegistrations = async (authHeader) => {
  const registerServiceUrl = process.env.REGISTER_SERVICE_URL;

  if (!registerServiceUrl) {
    throw createHttpError(500, 'REGISTER_SERVICE_URL is not configured');
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
    throw createHttpError(401, 'Unauthorized while validating registration');
  }

  if (response.status === 403) {
    throw createHttpError(403, 'Only participants can submit for targets');
  }

  if (!response.ok) {
    throw createHttpError(503, 'Could not validate registration');
  }

  if (!result || !Array.isArray(result.items)) {
    throw createHttpError(503, 'Invalid register-service response');
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
    throw createHttpError(403, 'You cannot submit a photo for your own target');
  }

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

  const registrations = await fetchMyRegistrations(authHeader);
  const isRegistered = registrations.some(
    (registration) => String(registration.targetId) === String(targetId)
  );

  if (!isRegistered) {
    throw createHttpError(
      403,
      'You must be registered for this target before submitting'
    );
  }

  return target;
};

module.exports = {
  assertParticipant,
  assertOwner,
  fetchTargetById,
  validateSubmissionRules
};
