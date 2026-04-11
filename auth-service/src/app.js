const express = require('express');
const authRoutes = require('./routes/authRoutes');
const internalUserRoutes = require('./routes/internalUserRoutes');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();

app.use(express.json());

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

app.use('/auth', authRoutes);
app.use('/api/internal', internalUserRoutes);

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
