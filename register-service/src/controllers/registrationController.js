const registrationService = require('../services/registrationService');

const createRegistration = async (req, res, next) => {
  try {
    const registration = await registrationService.createRegistration({
      targetId: req.body.targetId,
      user: req.user
    });

    res.status(201).json({
      message: 'Registration created successfully',
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

const getMyRegistrations = async (req, res, next) => {
  try {
    const result = await registrationService.getMyRegistrations({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getRegistrationsByTarget = async (req, res, next) => {
  try {
    const result = await registrationService.getRegistrationsByTarget({
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

const deleteRegistration = async (req, res, next) => {
  try {
    const result = await registrationService.deleteRegistration({
      registrationId: req.params.id,
      user: req.user
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const closeRegistrationsForTarget = async (req, res, next) => {
  try {
    const result = await registrationService.closeRegistrationsForTarget({
      targetId: req.params.targetId,
      user: req.user
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
  createRegistration,
  getMyRegistrations,
  getRegistrationsByTarget,
  deleteRegistration,
  closeRegistrationsForTarget
};
