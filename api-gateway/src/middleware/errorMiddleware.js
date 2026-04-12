const notFound = (req, res, _next) => {
  res.status(404).json({
    message: `Route not found: ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, _next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error'
  });
};

module.exports = {
  notFound,
  errorHandler
};
