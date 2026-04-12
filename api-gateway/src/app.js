const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');

const healthRoutes = require('./routes/healthRoutes');
const { getSwaggerUiOptions } = require('./utils/docsConfig');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const {
  metricsMiddleware,
  metricsHandler
} = require('./middleware/metricsMiddleware');

const app = express();
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

const sendProxyError = (serviceName, res, err) => {
  console.error(`${serviceName} proxy error:`, err.message);

  if (res.headersSent) {
    return;
  }

  res.status(503).json({
    message: `${serviceName} service unavailable`
  });
};

app.use(cors());
app.use(morgan('dev'));
app.use(metricsMiddleware);
app.use('/docs/openapi', express.static(path.join(__dirname, 'docs')));

app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '7d',
    etag: true
  })
);

app.use('/health', healthRoutes);
app.get('/metrics', metricsHandler);

app.use(
  '/auth',
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 5000,
    pathRewrite: (path) => `/auth${path}`,
    on: {
      error: (err, req, res) => {
        sendProxyError('Auth', res, err);
      }
    }
  })
);

app.use(
  '/api/registrations',
  createProxyMiddleware({
    target: process.env.REGISTER_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 5000,
    pathRewrite: (path) => `/api/registrations${path}`,
    on: {
      error: (err, req, res) => {
        sendProxyError('Register', res, err);
      }
    }
  })
);

app.use(
  '/api/targets',
  createProxyMiddleware({
    target: process.env.TARGET_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 5000,
    pathRewrite: (path) => `/api/targets${path}`,
    on: {
      error: (err, req, res) => {
        sendProxyError('Target', res, err);
      }
    }
  })
);

app.use(
  '/api/submissions',
  createProxyMiddleware({
    target: process.env.SCORE_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 60000,
    pathRewrite: (path) => `/api/submissions${path}`,
    on: {
      error: (err, req, res) => {
        sendProxyError('Score', res, err);
      }
    }
  })
);

app.use(
  '/api/internal/clock',
  createProxyMiddleware({
    target: process.env.CLOCK_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 60000,
    pathRewrite: (path) => `/api/internal/clock${path}`,
    on: {
      error: (err, req, res) => {
        sendProxyError('Clock', res, err);
      }
    }
  })
);

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(null, getSwaggerUiOptions())
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
