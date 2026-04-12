const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const healthRoutes = require('./routes/healthRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const swaggerDocument = YAML.load(
  path.join(__dirname, 'docs', 'openapi.yaml')
);

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/submissions/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/health', healthRoutes);
app.use('/api/submissions', submissionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
