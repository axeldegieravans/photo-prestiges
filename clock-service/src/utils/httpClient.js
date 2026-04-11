const { safeParseJson } = require('./httpJson');
const { createHttpError } = require('./httpError');

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

  const error = createHttpError(503, `${serviceName} circuit is open`);
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
      const error = createHttpError(503, `${serviceName} request timed out`);
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
    throw createHttpError(500, `${serviceName} URL is not configured`);
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
        const error = createHttpError(
          response.status >= 500 ? 503 : response.status,
          result?.message || `${serviceName} request failed`
        );
        error.retryable = response.status >= 500;
        throw error;
      }

      recordCircuitSuccess(circuitKey);
      return result;
    } catch (err) {
      lastError = err;

      if (!err.statusCode) {
        lastError = createHttpError(503, `${serviceName} is unavailable`);
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

module.exports = {
  fetchJson
};
