const express = require('express');
const internalUserController = require('../controllers/internalUserController');
const { requireInternalService } = require('../middleware/internalServiceMiddleware');

const router = express.Router();

router.post(
  '/users/batch',
  requireInternalService,
  internalUserController.getUsersBatch
);

module.exports = router;