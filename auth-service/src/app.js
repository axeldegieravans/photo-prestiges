const express = require('express');
const authRoutes = require('./routes/authRoutes');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const {
  metricsMiddleware,
  metricsHandler
} = require('./middleware/metricsMiddleware');

const app = express();

app.use(express.json());
app.use(metricsMiddleware);

const swaggerDocument = YAML.load(
  path.join(__dirname, 'docs', 'openapi.yaml')
);

app.use('/auth/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'auth-service'
  });
});

app.get('/metrics', metricsHandler);

app.use('/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

app.use((err, req, res, _next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error'
  });
});

module.exports = app;
