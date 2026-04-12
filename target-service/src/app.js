const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const healthRoutes = require('./routes/healthRoutes');
const targetRoutes = require('./routes/targetRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const swaggerDocument = YAML.load(
  path.join(__dirname, 'docs', 'openapi.yaml')
);

app.use('/api/targets/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/health', healthRoutes);
app.use('/api/targets', targetRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
