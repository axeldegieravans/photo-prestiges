const express = require('express');
const submissionController = require('../controllers/submissionController');
const {
  authenticate,
  authorizeRoles
} = require('../middleware/authMiddleware');
const { uploadSubmissionImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  uploadSubmissionImage.single('image'),
  submissionController.createSubmission
);

router.get(
  '/me',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  submissionController.getMySubmissions
);

router.get(
  '/me/:targetId',
  authenticate,
  authorizeRoles('PARTICIPANT'),
  submissionController.getMySubmissionForTarget
);

router.get(
  '/target/:targetId',
  authenticate,
  authorizeRoles('OWNER'),
  submissionController.getSubmissionsByTarget
);

router.delete(
  '/:id',
  authenticate,
  submissionController.deleteSubmission
);

module.exports = router;