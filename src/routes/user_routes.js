const router = require('express').Router();
const { param } = require('express-validator');
const apiErrorReporter = require('../utils/apierrorreporter');
const redis = require('../utils/redisclient');

const redisClient = redis.getClient();

const SENSITIVE_FIELD_NAMES = ['password'];

const removeSensitiveFields = (searchResults, ...fields) => {
  // Deep copy the searchResults array... avoids creating a side-effect function.
  const newSearchResults = JSON.parse(JSON.stringify(searchResults));
  /* eslint-disable no-param-reassign */
  newSearchResults.map((searchResult) => fields.map((fieldName) => delete searchResult[fieldName]));
  /* eslint-enable */

  return newSearchResults;
};

router.get(
  '/user/:userId',
  [
    param('userId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { userId } = req.params;
    const userKey = redis.getKeyName('users', userId);

    const userDetail = await redisClient.hgetall(userKey);
    SENSITIVE_FIELD_NAMES.map((fieldName) => delete userDetail[fieldName]);

    res.status(200).json(userDetail);
  },
);

// Get user by email address.
router.get(
  '/user/email/:emailAddress',
  [
    param('emailAddress').isEmail(),
    apiErrorReporter,
  ],
  async (req, res) => {
    // Need to escape . and @ in the email address when searching.
    /* eslint-disable no-useless-escape */
    const emailAddress = req.params.emailAddress.replace(/\./g, '\\.').replace(/\@/g, '\\@');
    /* eslint-enable */
    const searchResults = await redis.performSearch('usersidx', `@email:{${emailAddress}}`);

    const response = searchResults.length === 1
      ? removeSensitiveFields(searchResults, ...SENSITIVE_FIELD_NAMES)[0]
      : searchResults;

    res.status(200).json(response);
  },
);

// Get users that have recently checked in somewhere.
router.get(
  '/users/recent',
  async (req, res) => {
    // Let's say checkins from the start of yesterday or newer count as "recent"...
    // TODO might want to rethink that...
    const d = new Date();
    const now = d.getTime();

    d.setDate(d.getDate() - 1);
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);

    const searchResults = await redis.performSearch('usersidx', `@lastCheckin:[${d.getTime()} ${now}]`, 'SORTBY', 'lastCheckin', 'DESC');
    res.status(200).json(removeSensitiveFields(searchResults, ...SENSITIVE_FIELD_NAMES));
  },
);

// Get the top 100 users by number of checkins.
router.get(
  '/users/bycheckins',
  async (req, res) => {
    const searchResults = await redis.performSearch('usersidx', '*', 'SORTBY', 'numCheckins', 'DESC', 'LIMIT', '0', '100');

    res.status(200).json(removeSensitiveFields(searchResults, ...SENSITIVE_FIELD_NAMES));
  },
);

module.exports = router;
