const targetService = require('../services/targetService');

const finalizeTargetInternal = async (req, res, next) => {
  try {
    const target = await targetService.finalizeTargetInternal({
      targetId: req.params.targetId,
      data: req.body
    });

    res.status(200).json({
      message: 'Target finalized successfully',
      data: target
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  finalizeTargetInternal
};
