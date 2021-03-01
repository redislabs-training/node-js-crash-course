const router = require('express').Router();
const apiErrorReporter = require('../utils/apierrorreporter');

// This should also optionally take a withDetails request parameter.
router.get(
  '/location/:locationId',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// This should also optionally take a sections request parameter to
// selectively retrieve part of the JSON.
router.get(
  '/location/:locationId/details',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// This should also optionally take location type and min star rating request parameters.
router.get(
  '/locations/:latitude/:longitude/:radius',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// Call an external weather API to get weather for a given location ID.
router.get(
  '/location/:locationId/weather',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
