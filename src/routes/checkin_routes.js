const router = require('express').Router();
const { param } = require('express-validator');
const apiErrorReporter = require('../utils/apierrorreporter');

const timestampValidator = (value, { req }) => {
  const startTime = parseInt(req.params.startTime, 10);
  const endTime = parseInt(req.params.endTime, 10);

  if (startTime > endTime) {
    throw new Error('startTime must be less than or equal to endTime.');
  }

  return true;
};

router.get(
  '/checkins/:startTime/:endTime',
  [
    param('startTime').isInt({ min: 0 }).custom(timestampValidator),
    param('endTime').isInt({ min: 0 }).custom(timestampValidator),
    apiErrorReporter,
  ],
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
