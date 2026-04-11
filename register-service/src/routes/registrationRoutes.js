const express = require('express');
const registrationController = require('../controllers/registrationController');
const {
  authenticate,
  authorizeRoles
} = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  registrationController.createRegistration
);

router.get(
  '/me',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  registrationController.getMyRegistrations
);

router.get(
  '/target/:targetId',
  authenticate,
  authorizeRoles('OWNER'),
  registrationController.getRegistrationsByTarget
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  registrationController.deleteRegistration
);

router.patch(
  '/target/:targetId/close',
  authenticate,
  authorizeRoles('OWNER'),
  registrationController.closeRegistrationsForTarget
);

module.exports = router;