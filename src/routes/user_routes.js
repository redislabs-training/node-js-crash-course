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

// Get user by ID.
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

// EXERCISE: Get user's full name.
router.get(
  '/user/:userId/fullname',
  [
    param('userId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { userId } = req.params;
    /* eslint-disable no-unused-vars */
    const userKey = redis.getKeyName('users', userId);
    /* eslint-enable */

    // TODO: Get the firstName and lastName fields from the
    // user hash whose key is in userKey.
    // HINT: Check out the HMGET command...
    // https://redis.io/commands/hmget
    const [firstName, lastName] = ['TODO', 'TODO'];

    res.status(200).json({ fullName: `${firstName} ${lastName}` });
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
    const searchResults = await redis.performSearch(redis.getKeyName('usersidx'), `@email:{${emailAddress}}`);

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
    const d = new Date();
    const now = d.getTime();

    d.setDate(d.getDate() - 1);
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);

    const searchResults = await redis.performSearch(redis.getKeyName('usersidx'), `@lastCheckin:[${d.getTime()} ${now}]`, 'SORTBY', 'lastCheckin', 'DESC');
    res.status(200).json(removeSensitiveFields(searchResults, ...SENSITIVE_FIELD_NAMES));
  },
);

// Get the top 100 users by number of checkins.
router.get(
  '/users/bycheckins',
  async (req, res) => {
    const searchResults = await redis.performSearch(redis.getKeyName('usersidx'), '*', 'SORTBY', 'numCheckins', 'DESC', 'LIMIT', '0', '100');
    res.status(200).json(removeSensitiveFields(searchResults, ...SENSITIVE_FIELD_NAMES));
  },
);

// EXERCISE: Get the user(s) last seen at a given location.
router.get(
  '/users/at/:locationId',
  [
    param('locationId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    /* eslint-disable no-unused-vars */
    const { locationId } = req.params;
    /* eslint-enable */

    // Replace 'TODO... YOUR QUERY HERE' with a query that will find all
    // users whose lastSeenAt field is set to the value stored in locationId.
    // lastSeenAt was indexed as a numeric type, so you'll need to use the
    // "numeric range" syntax for this -- see documentation for help:
    // https://oss.redislabs.com/redisearch/Query_Syntax/
    const searchResults = await redis.performSearch(
      redis.getKeyName('usersidx'),
      'TODO... YOUR QUERY HERE',
    );
    res.status(200).json(removeSensitiveFields(searchResults, 'email', ...SENSITIVE_FIELD_NAMES));
  },
);

module.exports = router;
