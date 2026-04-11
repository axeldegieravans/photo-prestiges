const submissionService = require('../services/submissionService');

const createSubmission = async (req, res, next) => {
  try {
    const submission = await submissionService.createSubmission({
      data: req.body,
      user: req.user,
      authHeader: req.headers.authorization,
      file: req.file
    });

    res.status(201).json({
      message: 'Submission created successfully',
      data: submission
    });
  } catch (error) {
    next(error);
  }
};

const getMySubmissions = async (req, res, next) => {
  try {
    const result = await submissionService.getMySubmissions({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMySubmissionForTarget = async (req, res, next) => {
  try {
    const submission = await submissionService.getMySubmissionForTarget({
      targetId: req.params.targetId,
      user: req.user
    });

    res.status(200).json({
      data: submission
    });
  } catch (error) {
    next(error);
  }
};

const getSubmissionsByTarget = async (req, res, next) => {
  try {
    const result = await submissionService.getSubmissionsByTarget({
      targetId: req.params.targetId,
      user: req.user,
      page: req.query.page,
      limit: req.query.limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteSubmission = async (req, res, next) => {
  try {
    const result = await submissionService.deleteSubmission({
      submissionId: req.params.id,
      user: req.user
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubmission,
  getMySubmissions,
  getMySubmissionForTarget,
  getSubmissionsByTarget,
  deleteSubmission
};