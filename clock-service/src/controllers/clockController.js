const {
  startCompetitionForTarget,
  runDeadlineCycle
} = require('../services/clockService');

const runClock = async (req, res, next) => {
  try {
    const result = await runDeadlineCycle({
      now: req.body?.now,
      source: 'manual'
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const startTargetClock = async (req, res, next) => {
  try {
    const trackedCompetition = await startCompetitionForTarget({
      data: req.body
    });

    res.status(200).json({
      message: 'Competition tracking started successfully',
      data: trackedCompetition
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  runClock,
  startTargetClock
};
