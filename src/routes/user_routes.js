const router = require('express').Router();
const { param } = require('express-validator');
const apiErrorReporter = require('../utils/apierrorreporter');
const redis = require('../utils/redisclient');

const redisClient = redis.getClient();

router.get(
  '/user/:userId',
  [
    param('userId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res, next) => {
    const { userId } = req.params;
    const userKey = redis.getKeyName('users', userId);

    const userDetail = await redisClient.hgetall(userKey);
    delete userDetail.password;

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
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// Get users that have recently checked in somewhere.
router.get(
  '/users/recent',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

// Get the top 100 users by number of checkins.
router.get(
  '/users/bycheckins',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
