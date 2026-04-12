const client = require('prom-client');

client.collectDefaultMetrics({
  prefix: 'photo_prestiges_auth_'
});

const httpRequestDuration = new client.Histogram({
  name: 'photo_prestiges_auth_http_request_duration_seconds',
  help: 'Duration of HTTP requests handled by the auth service in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const normalizeRoute = (req) => {
  return req.baseUrl || req.route?.path || req.path || 'unknown';
};

const metricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }

  const endTimer = httpRequestDuration.startTimer();

  res.on('finish', () => {
    endTimer({
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode)
    });
  });

  next();
};

const metricsHandler = async (req, res, next) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    next(error);
  }
};

module.exports = {
  metricsMiddleware,
  metricsHandler
};
