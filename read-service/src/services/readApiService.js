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

const fetchJson = async ({ serviceName, baseUrl, path, authHeader }) => {
  if (!baseUrl) {
    const error = new Error(`${serviceName} URL is not configured`);
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: authHeader
        ? {
            Authorization: authHeader
          }
        : {}
    });

    const result = await safeParseJson(response);

    if (!response.ok) {
      const error = new Error(
        result?.message || `${serviceName} request failed`
      );

      error.statusCode = response.status >= 500 ? 503 : response.status;
      throw error;
    }

    return result;
  } catch (err) {
    if (err.statusCode) {
      throw err;
    }

    const error = new Error(`${serviceName} is unavailable`);
    error.statusCode = 503;
    throw error;
  }
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

const fetchActiveTargetsPage = async ({ page, limit, city, search }) => {
  return fetchJson({
    serviceName: 'Target service',
    baseUrl: process.env.TARGET_SERVICE_URL,
    path: `/api/targets${buildQueryString({
      status: 'OPEN',
      page,
      limit,
      city,
      search
    })}`
  });
};

const fetchOwnerTargets = async (authHeader) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Target service',
      baseUrl: process.env.TARGET_SERVICE_URL,
      path: `/api/targets/me${buildQueryString({ page, limit })}`,
      authHeader
    })
  );
};

const fetchRegistrationsByTarget = async (targetId, authHeader) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Register service',
      baseUrl: process.env.REGISTER_SERVICE_URL,
      path: `/api/registrations/target/${targetId}${buildQueryString({
        page,
        limit
      })}`,
      authHeader
    })
  );
};

const fetchSubmissionsByTarget = async (targetId, authHeader) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Score service',
      baseUrl: process.env.SCORE_SERVICE_URL,
      path: `/api/submissions/target/${targetId}${buildQueryString({
        page,
        limit
      })}`,
      authHeader
    })
  );
};

const fetchMyRegistrations = async (authHeader) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Register service',
      baseUrl: process.env.REGISTER_SERVICE_URL,
      path: `/api/registrations/me${buildQueryString({ page, limit })}`,
      authHeader
    })
  );
};

const fetchMySubmissions = async (authHeader) => {
  return fetchAllPages((page, limit) =>
    fetchJson({
      serviceName: 'Score service',
      baseUrl: process.env.SCORE_SERVICE_URL,
      path: `/api/submissions/me${buildQueryString({ page, limit })}`,
      authHeader
    })
  );
};

module.exports = {
  fetchTargetById,
  fetchActiveTargetsPage,
  fetchOwnerTargets,
  fetchRegistrationsByTarget,
  fetchSubmissionsByTarget,
  fetchMyRegistrations,
  fetchMySubmissions
};