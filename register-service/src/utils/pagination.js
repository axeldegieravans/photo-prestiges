const normalizePagination = (page, limit) => {
  const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit
  };
};

module.exports = {
  normalizePagination
};
