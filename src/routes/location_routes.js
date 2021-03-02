const router = require('express').Router();
const { param, query } = require('express-validator');
const apiErrorReporter = require('../utils/apierrorreporter');

// This should also optionally take a withDetails request parameter.
router.get(
  '/location/:locationId',
  [
    param('locationId').isInt({ min: 1 }),
    query('withDetails').isBoolean().optional(),
    apiErrorReporter,
  ],
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// This should also optionally take a sections request parameter to
// selectively retrieve part of the JSON.
router.get(
  '/location/:locationId/details',
  [
    param('locationId').isInt({ min: 1 }),
    query('sections').isString().optional(),
    apiErrorReporter,
  ],
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// This should also optionally take location type and min star rating request parameters.
router.get(
  '/locations/:latitude/:longitude/:radius',
  [
    param('latitude').isFloat(),
    param('longitude').isFloat(),
    param('radius').isInt({ min: 1 }),
    query('type').isString().optional(),
    query('minStars').isInt({ min: 1, max: 5 }).optional(),
    apiErrorReporter,
  ],
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// Call an external weather API to get weather for a given location ID.
router.get(
  '/location/:locationId/weather',
  [
    param('locationId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
