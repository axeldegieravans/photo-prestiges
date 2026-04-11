const express = require('express');
const clockController = require('../controllers/clockController');
const { requireInternalService } = require('../middleware/internalServiceMiddleware');

const internalClockRoutes = express.Router();

internalClockRoutes.post(
  '/run',
  requireInternalService,
  clockController.runClock
);

internalClockRoutes.post(
  '/targets/start',
  requireInternalService,
  clockController.startTargetClock
);

module.exports = {
  internalClockRoutes
};
