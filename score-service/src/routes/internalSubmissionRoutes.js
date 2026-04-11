const express = require('express');
const internalSubmissionController = require('../controllers/internalSubmissionController');
const { requireInternalService } = require('../middleware/internalServiceMiddleware');

const router = express.Router();

router.get(
  '/target/:targetId',
  requireInternalService,
  internalSubmissionController.getSubmissionsByTargetInternal
);

module.exports = router;