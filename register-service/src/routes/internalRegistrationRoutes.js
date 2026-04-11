const express = require('express');
const internalRegistrationController = require('../controllers/internalRegistrationController');
const { requireInternalService } = require('../middleware/internalServiceMiddleware');

const router = express.Router();

router.get(
  '/target/:targetId',
  requireInternalService,
  internalRegistrationController.getRegistrationsByTargetInternal
);

router.patch(
  '/target/:targetId/close',
  requireInternalService,
  internalRegistrationController.closeRegistrationsForTargetInternal
);

module.exports = router;