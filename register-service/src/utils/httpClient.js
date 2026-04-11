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

      lastError = new Error('Internal service request failed');
      lastError.statusCode = 503;

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

  const error = new Error('Internal service is unavailable');
  error.statusCode = 503;
  error.cause = lastError;
  throw error;
};

module.exports = {
  safeParseJson,
  fetchWithRetry
};
