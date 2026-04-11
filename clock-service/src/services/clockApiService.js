const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const circuitStates = new Map();

const getRetryCount = () => {
  return Math.max(Number(process.env.INTERNAL_HTTP_RETRIES) || 2, 0);
};

const getRetryDelayMs = () => {
  return Math.max(Number(process.env.INTERNAL_HTTP_RETRY_DELAY_MS) || 250, 0);
};

const getRequestTimeoutMs = () => {
  return Math.max(Number(process.env.INTERNAL_HTTP_TIMEOUT_MS) || 5000, 1000);
};

const getCircuitBreakerFailureThreshold = () => {
  return Math.max(Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD) || 3, 1);
};

const getCircuitBreakerCooldownMs = () => {
  return Math.max(Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS) || 10000, 1000);
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getCircuitState = (key) => {
  if (!circuitStates.has(key)) {
    circuitStates.set(key, {
      failures: 0,
      openedAt: null
    });
  }

  return circuitStates.get(key);
};

const assertCircuitClosed = (key, serviceName) => {
  const state = getCircuitState(key);

  if (!state.openedAt) {
    return;
  }

  const elapsedMs = Date.now() - state.openedAt;

  if (elapsedMs >= getCircuitBreakerCooldownMs()) {
    state.openedAt = null;
    state.failures = 0;
    return;
  }

  const error = new Error(`${serviceName} circuit is open`);
  error.statusCode = 503;
  error.retryable = true;
  throw error;
};

const recordCircuitSuccess = (key) => {
  const state = getCircuitState(key);
  state.failures = 0;
  state.openedAt = null;
};

const recordCircuitFailure = (key) => {
  const state = getCircuitState(key);
  state.failures += 1;

  if (state.failures >= getCircuitBreakerFailureThreshold()) {
    state.openedAt = Date.now();
  }
};

const shouldRetry = (error) => {
  return Boolean(error.retryable || error.statusCode >= 500);
};

const withTimeout = ({ serviceName, url, options }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout)).catch((err) => {
    if (err.name === 'AbortError') {
      const error = new Error(`${serviceName} request timed out`);
      error.statusCode = 503;
      error.retryable = true;
      throw error;
    }

    throw err;
  });
};

const fetchJson = async ({
  serviceName,
  baseUrl,
  path,
  method = 'GET',
  body,
  internalToken
}) => {
  if (!baseUrl) {
    const error = new Error(`${serviceName} URL is not configured`);
    error.statusCode = 500;
    throw error;
  }

  const headers = {};

  if (internalToken) {
    headers['x-internal-service-token'] = internalToken;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const circuitKey = `${serviceName}:${baseUrl}`;
  const maxAttempts = getRetryCount() + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      assertCircuitClosed(circuitKey, serviceName);

      const response = await withTimeout({
        serviceName,
        url: `${baseUrl}${path}`,
        options: {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        }
      });

      const result = await safeParseJson(response);

      if (!response.ok) {
        const error = new Error(
          result?.message || `${serviceName} request failed`
        );

        error.statusCode = response.status >= 500 ? 503 : response.status;
        error.retryable = response.status >= 500;
        throw error;
      }

      recordCircuitSuccess(circuitKey);
      return result;
    } catch (err) {
      lastError = err;

      if (!err.statusCode) {
        lastError = new Error(`${serviceName} is unavailable`);
        lastError.statusCode = 503;
        lastError.retryable = true;
      }

      if (!shouldRetry(lastError) || attempt === maxAttempts) {
        if (shouldRetry(lastError)) {
          recordCircuitFailure(circuitKey);
        }

        throw lastError;
      }

      await sleep(getRetryDelayMs() * attempt);
    }
  }

  throw lastError;
};

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
