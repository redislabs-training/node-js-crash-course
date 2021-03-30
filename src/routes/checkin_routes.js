const router = require('express').Router();
const { param } = require('express-validator');
const redis = require('../utils/redisclient');
const apiErrorReporter = require('../utils/apierrorreporter');

const redisClient = redis.getClient();

const timestampValidator = (value, { req }) => {
  const startTime = parseInt(req.params.startTime, 10);
  const endTime = parseInt(req.params.endTime, 10);

  if (startTime > endTime) {
    throw new Error('startTime must be less than or equal to endTime.');
  }

  return true;
};

const buildCheckinObjects = (checkins) => {
  // Convert XRANGE's array of arrays response to array of objects.
  const response = [];

  for (const checkin of checkins) {
    const [id, fieldsValues] = checkin;

    const obj = {
      id,
    };

    for (let n = 0; n < fieldsValues.length; n += 2) {
      obj[fieldsValues[n]] = fieldsValues[n + 1];
    }

    response.push(obj);
  }

  return response;
};

router.get(
  '/checkins/:startTime/:endTime',
  [
    param('startTime').isInt({ min: 0 }).custom(timestampValidator),
    param('endTime').isInt({ min: 0 }).custom(timestampValidator),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { startTime, endTime } = req.params;
    const checkinStreamKey = redis.getKeyName('checkins');

    // Get maximum 1000 records so we don't create a huge load.
    const checkins = await redisClient.xrange(checkinStreamKey, startTime, endTime, 'COUNT', '1000');

    // Convert array of arrays response to array of objects.
    const response = buildCheckinObjects(checkins);

    res.status(200).json(response);
  },
);

// EXERCISE: Get the latest checkin.
router.get(
  '/checkins/latest',
  async (req, res) => {
    const checkinStreamKey = redis.getKeyName('checkins');

    // TODO: Use the XREVRANGE command to get just the latest
    // (most recent) checkin from the stream whose key is
    // stored in checkinStreamKey.
    // https://redis.io/commands/xrevrange
    const latestCheckin = await redisClient.xrevrange(checkinStreamKey, 'TODO');

    // Convert array of arrays response to array of objects.
    const response = buildCheckinObjects(latestCheckin);

    res.status(200).json(response);
  },
);

module.exports = router;
