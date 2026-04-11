const express = require('express');
const targetController = require('../controllers/targetController');
const {
  authenticate,
  authorizeRoles
} = require('../middleware/authMiddleware');
const { uploadTargetImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorizeRoles('OWNER'),
  uploadTargetImage.single('image'),
  targetController.createTarget
);

router.get('/', targetController.getTargets);

router.get(
  '/me',
  authenticate,
  authorizeRoles('OWNER'),
  targetController.getMyTargets
);

router.get('/:id', targetController.getTargetById);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('OWNER'),
  targetController.deleteTarget
);

router.post(
  '/:id/vote',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  targetController.voteOnTarget
);

module.exports = router;