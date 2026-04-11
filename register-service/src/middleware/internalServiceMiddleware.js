const requireInternalService = (req, res, next) => {
  const token = req.headers['x-internal-service-token'];

  if (!token) {
    const error = new Error('Internal service token is required');
    error.statusCode = 401;
    return next(error);
  }

  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    const error = new Error('Invalid internal service token');
    error.statusCode = 403;
    return next(error);
  }

  next();
};

module.exports = {
  requireInternalService
};