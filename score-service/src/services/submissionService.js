const path = require('path');
const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const { analyzeImageSimilarity } = require('./imageAnalysisService');
const { normalizePagination } = require('../utils/pagination');
const {
  buildSubmissionImageUrl,
  deleteFileIfExists
} = require('../utils/fileStorage');
const {
  assertParticipant,
  assertOwner,
  fetchTargetById,
  validateSubmissionRules
} = require('./submissionValidationService');

const PARTICIPANT = 'PARTICIPANT';
const OWNER = 'OWNER';

const createSubmission = async ({ data, user, authHeader, file }) => {
  assertParticipant(user);

  const { targetId } = data;

  if (!targetId) {
    if (file?.path) {
      await deleteFileIfExists(file.path);
    }

    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  if (!file) {
    const error = new Error('image file is required');
    error.statusCode = 400;
    throw error;
  }

  try {
    const target = await validateSubmissionRules({
      targetId,
      participantId: user.userId,
      authHeader
    });

    if (!target.imageFilename) {
      const error = new Error(
        'Target image file is missing. Recreate the target with the new upload flow.'
      );
      error.statusCode = 500;
      throw error;
    }

    const targetImagePath = path.join(
      process.cwd(),
      'uploads',
      'targets',
      target.imageFilename
    );

    const analysis = await analyzeImageSimilarity({
      targetImagePath,
      targetImageFilename: target.imageFilename,
      submissionImagePath: file.path,
      submissionImageFilename: file.filename
    });

    const submission = await Submission.create({
      targetId,
      participantId: user.userId,
      imageUrl: buildSubmissionImageUrl(file.filename),
      imageFilename: file.filename,
      similarityScore: analysis.similarityScore,
      analysisProvider: analysis.provider,
      analysisSummary: analysis.summary
    });

    return submission;
  } catch (err) {
    await deleteFileIfExists(file?.path);

    if (err.code === 11000) {
      const error = new Error(
        'You have already submitted a photo for this target'
      );
      error.statusCode = 409;
      throw error;
    }

    throw err;
  }
};

const getMySubmissions = async ({ user, page, limit }) => {
  assertParticipant(user);

  const {
    skip,
    page: normalizedPage,
    limit: normalizedLimit
  } = normalizePagination(page, limit);

  const [submissions, total] = await Promise.all([
    Submission.find({ participantId: user.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    Submission.countDocuments({ participantId: user.userId })
  ]);

  return {
    items: submissions,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

const getMySubmissionForTarget = async ({ targetId, user }) => {
  assertParticipant(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const submission = await Submission.findOne({
    targetId,
    participantId: user.userId
  });

  if (!submission) {
    const error = new Error('Submission not found');
    error.statusCode = 404;
    throw error;
  }

  return submission;
};

const getSubmissionsByTarget = async ({ targetId, user, page, limit }) => {
  assertOwner(user);

  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const target = await fetchTargetById(targetId);

  if (String(target.ownerId) !== String(user.userId)) {
    const error = new Error('You can only view submissions for your own target');
    error.statusCode = 403;
    throw error;
  }

  const {
    skip,
    page: normalizedPage,
    limit: normalizedLimit
  } = normalizePagination(page, limit);

  const [submissions, total] = await Promise.all([
    Submission.find({ targetId })
      .sort({ similarityScore: -1, submittedAt: 1 })
      .skip(skip)
      .limit(normalizedLimit),
    Submission.countDocuments({ targetId })
  ]);

  return {
    targetId,
    items: submissions,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

const deleteSubmission = async ({ submissionId, user }) => {
  if (!user) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const error = new Error('Invalid submission id');
    error.statusCode = 400;
    throw error;
  }

  const submission = await Submission.findById(submissionId);

  if (!submission) {
    const error = new Error('Submission not found');
    error.statusCode = 404;
    throw error;
  }

  const isParticipantOwner =
    user.role === PARTICIPANT &&
    String(submission.participantId) === String(user.userId);

  let isTargetOwner = false;

  if (user.role === OWNER) {
    const target = await fetchTargetById(submission.targetId);
    isTargetOwner = String(target.ownerId) === String(user.userId);
  }

  if (!isParticipantOwner && !isTargetOwner) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  const filePath = submission.imageFilename
    ? path.join(process.cwd(), 'uploads', 'submissions', submission.imageFilename)
    : null;

  await submission.deleteOne();
  await deleteFileIfExists(filePath);

  return {
    message: 'Submission deleted successfully'
  };
};

const deleteSubmissionsForTargetInternal = async ({ targetId }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const submissions = await Submission.find({ targetId });

  await Promise.all(
    submissions.map((submission) => {
      const filePath = submission.imageFilename
        ? path.join(process.cwd(), 'uploads', 'submissions', submission.imageFilename)
        : null;

      return deleteFileIfExists(filePath);
    })
  );

  const result = await Submission.deleteMany({ targetId });

  return {
    targetId,
    deletedCount: result.deletedCount || 0
  };
};

const getSubmissionsByTargetInternal = async ({ targetId, page, limit }) => {
  if (!targetId) {
    const error = new Error('targetId is required');
    error.statusCode = 400;
    throw error;
  }

  const {
    skip,
    page: normalizedPage,
    limit: normalizedLimit
  } = normalizePagination(page, limit);

  const [submissions, total] = await Promise.all([
    Submission.find({ targetId })
      .sort({ similarityScore: -1, submittedAt: 1 })
      .skip(skip)
      .limit(normalizedLimit),
    Submission.countDocuments({ targetId })
  ]);

  return {
    targetId,
    items: submissions,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.ceil(total / normalizedLimit) || 1
    }
  };
};

module.exports = {
  createSubmission,
  getMySubmissions,
  getMySubmissionForTarget,
  getSubmissionsByTarget,
  getSubmissionsByTargetInternal,
  deleteSubmission,
  deleteSubmissionsForTargetInternal
};
