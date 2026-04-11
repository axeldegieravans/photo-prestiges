const registrationService = require('../services/registrationService');

const getRegistrationsByTargetInternal = async (req, res, next) => {
  try {
    const result = await registrationService.getRegistrationsByTargetInternal({
      targetId: req.params.targetId
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const closeRegistrationsForTargetInternal = async (req, res, next) => {
  try {
    const result = await registrationService.closeRegistrationsForTargetInternal({
      targetId: req.params.targetId,
      closedAt: req.body?.closedAt
    });

    res.status(200).json({
      message: 'Registrations closed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRegistrationsByTargetInternal,
  closeRegistrationsForTargetInternal
};