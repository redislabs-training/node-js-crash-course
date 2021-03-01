const router = require('express').Router();
const apiErrorReporter = require('../utils/apierrorreporter');

router.get(
  '/checkins/:startTime/:endTime',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
