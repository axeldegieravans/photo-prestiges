const { createHttpError } = require('./httpError');

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const getRetryCount = () => {
  return Math.max(Number(process.env.INTERNAL_HTTP_RETRIES) || 2, 0);
};

const getRetryDelayMs = () => {
  return Math.max(Number(process.env.INTERNAL_HTTP_RETRY_DELAY_MS) || 250, 0);
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const fetchWithRetry = async (url, options = {}) => {
  const maxAttempts = getRetryCount() + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (response.status < 500) {
        return response;
      }

      lastError = createHttpError(503, 'Internal service request failed');

      if (attempt === maxAttempts) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }
    }

    await sleep(getRetryDelayMs() * attempt);
  }

  const error = createHttpError(503, 'Internal service is unavailable');
  error.cause = lastError;
  throw error;
};

module.exports = {
  safeParseJson,
  fetchWithRetry
};
