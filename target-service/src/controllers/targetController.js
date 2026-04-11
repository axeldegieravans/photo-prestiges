const targetService = require('../services/targetService');

const createTarget = async (req, res, next) => {
  try {
    const target = await targetService.createTarget({
      data: req.body,
      user: req.user,
      file: req.file
    });

    res.status(201).json({
      message: 'Target created successfully',
      data: target
    });
  } catch (error) {
    next(error);
  }
};

const getTargets = async (req, res, next) => {
  try {
    const result = await targetService.getTargets({
      page: req.query.page,
      limit: req.query.limit,
      city: req.query.city,
      status: req.query.status,
      ownerId: req.query.ownerId,
      search: req.query.search
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMyTargets = async (req, res, next) => {
  try {
    const result = await targetService.getMyTargets({
      user: req.user,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getTargetById = async (req, res, next) => {
  try {
    const target = await targetService.getTargetById({
      targetId: req.params.id
    });

    res.status(200).json({
      data: target
    });
  } catch (error) {
    next(error);
  }
};

const deleteTarget = async (req, res, next) => {
  try {
    const result = await targetService.deleteTarget({
      targetId: req.params.id,
      user: req.user
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const voteOnTarget = async (req, res, next) => {
  try {
    const result = await targetService.voteOnTarget({
      targetId: req.params.id,
      user: req.user,
      vote: req.body.vote
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTarget,
  getTargets,
  getMyTargets,
  getTargetById,
  deleteTarget,
  voteOnTarget
};