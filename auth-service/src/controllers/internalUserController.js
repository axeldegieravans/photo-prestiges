const authService = require('../services/authService');

const getUsersBatch = async (req, res, next) => {
  try {
    const result = await authService.getUsersBatch(req.body?.userIds);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsersBatch
};