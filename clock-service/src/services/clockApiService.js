const { buildQueryString } = require('../utils/queryString');
const { fetchJson } = require('../utils/httpClient');

const fetchAllPages = async (fetchPage) => {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await fetchPage(page, 100);
    const pageItems = Array.isArray(result.items) ? result.items : [];

    items.push(...pageItems);
    totalPages = result.pagination?.pages || 1;
    page += 1;
  } while (page <= totalPages);

  return items;
};

const fetchTargetById = async (targetId) => {
  const result = await fetchJson({
    serviceName: 'Target service',
    baseUrl: process.env.TARGET_SERVICE_URL,
    path: `/api/targets/${targetId}`
  });

  if (!result || !result.data) {
    const error = new Error('Invalid target-service response');
    error.statusCode = 503;
    throw error;
  }

  return result.data;
};

const fetchSubmissionsByTargetInternal = async (targetId) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Score service',
      baseUrl: process.env.SCORE_SERVICE_URL,
      path: `/api/internal/submissions/target/${targetId}${buildQueryString({
        page,
        limit
      })}`,
      internalToken: process.env.INTERNAL_SERVICE_TOKEN
    })
  );
};

const fetchRegistrationsByTargetInternal = async (targetId) => {
  const result = await fetchJson({
    serviceName: 'Register service',
    baseUrl: process.env.REGISTER_SERVICE_URL,
    path: `/api/internal/registrations/target/${targetId}`,
    internalToken: process.env.INTERNAL_SERVICE_TOKEN
  });

  return Array.isArray(result.items) ? result.items : [];
};

const closeRegistrationsForTargetInternal = async ({ targetId, closedAt }) => {
  return fetchJson({
    serviceName: 'Register service',
    baseUrl: process.env.REGISTER_SERVICE_URL,
    path: `/api/internal/registrations/target/${targetId}/close`,
    method: 'PATCH',
    internalToken: process.env.INTERNAL_SERVICE_TOKEN,
    body: {
      closedAt
    }
  });
};

const fetchUsersBatchInternal = async (userIds) => {
  const normalizedUserIds = [
    ...new Set(userIds.map((value) => String(value)).filter(Boolean))
  ];

  if (normalizedUserIds.length === 0) {
    return {
      items: [],
      missingUserIds: []
    };
  }

  return fetchJson({
    serviceName: 'Auth service',
    baseUrl: process.env.AUTH_SERVICE_URL,
    path: '/api/internal/users/batch',
    method: 'POST',
    internalToken: process.env.INTERNAL_SERVICE_TOKEN,
    body: {
      userIds: normalizedUserIds
    }
  });
};

const finalizeTargetInternal = async ({ targetId, winner, closedAt }) => {
  return fetchJson({
    serviceName: 'Target service',
    baseUrl: process.env.TARGET_SERVICE_URL,
    path: `/api/internal/targets/${targetId}/finalize`,
    method: 'PATCH',
    internalToken: process.env.INTERNAL_SERVICE_TOKEN,
    body: {
      winnerParticipantId: winner ? winner.participantId : null,
      winnerSubmissionId: winner ? winner._id : null,
      winningScore: winner ? winner.finalScore ?? winner.similarityScore : null,
      winningSubmittedAt: winner ? winner.submittedAt : null,
      closedAt
    }
  });
};

module.exports = {
  fetchTargetById,
  fetchSubmissionsByTargetInternal,
  fetchRegistrationsByTargetInternal,
  closeRegistrationsForTargetInternal,
  fetchUsersBatchInternal,
  finalizeTargetInternal
};
