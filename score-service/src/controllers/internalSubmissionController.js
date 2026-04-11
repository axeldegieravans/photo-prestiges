const submissionService = require('../services/submissionService');

const getSubmissionsByTargetInternal = async (req, res, next) => {
  try {
    const result = await submissionService.getSubmissionsByTargetInternal({
      targetId: req.params.targetId,
      page: req.query.page,
      limit: req.query.limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubmissionsByTargetInternal
};