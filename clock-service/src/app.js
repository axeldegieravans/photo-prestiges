const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const { internalClockRoutes } = require('./routes/clockRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/health', healthRoutes);
app.use('/api/internal/clock', internalClockRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
