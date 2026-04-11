const express = require('express');
const internalTargetController = require('../controllers/internalTargetController');
const { requireInternalService } = require('../middleware/internalServiceMiddleware');

const router = express.Router();

router.patch(
  '/:targetId/finalize',
  requireInternalService,
  internalTargetController.finalizeTargetInternal
);

module.exports = router;
