const express = require('express');
const readController = require('../controllers/readController');
const {
  authenticate,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/targets/active', readController.getActiveTargets);

router.get(
  '/owners/me/dashboard',
  authenticate,
  authorizeRoles('OWNER'),
  readController.getOwnerDashboard
);

router.get(
  '/owners/me/targets/:targetId/overview',
  authenticate,
  authorizeRoles('OWNER'),
  readController.getOwnerTargetOverview
);

router.get(
  '/participants/me/dashboard',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  readController.getParticipantDashboard
);

module.exports = router;