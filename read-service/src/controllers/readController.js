const readService = require('../services/readService');

const getActiveTargets = async (req, res, next) => {
  try {
    const result = await readService.getActiveTargets({
      page: req.query.page,
      limit: req.query.limit,
      city: req.query.city,
      search: req.query.search
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getOwnerDashboard = async (req, res, next) => {
  try {
    const result = await readService.getOwnerDashboard({
      user: req.user,
      authHeader: req.headers.authorization
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getOwnerTargetOverview = async (req, res, next) => {
  try {
    const result = await readService.getOwnerTargetOverview({
      targetId: req.params.targetId,
      user: req.user,
      authHeader: req.headers.authorization
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getParticipantDashboard = async (req, res, next) => {
  try {
    const result = await readService.getParticipantDashboard({
      user: req.user,
      authHeader: req.headers.authorization
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveTargets,
  getOwnerDashboard,
  getOwnerTargetOverview,
  getParticipantDashboard
};