const config = require('better-config');
const express = require('express');
const { body } = require('express-validator');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const morgan = require('morgan');
const cors = require('cors');
const logger = require('./utils/logger');
const apiErrorReporter = require('./utils/apierrorreporter');

config.set('../config.json');

const redis = require('./utils/redisclient');

const redisClient = redis.getClient();

const app = express();
app.use(morgan('combined', { stream: logger.stream }));
app.use(cors());
app.use(express.json());

app.use(session({
  secret: config.sessionSecret,
  store: new RedisStore({
    client: redis.getClient(),
    prefix: redis.getKeyName('session:'),
  }),
  name: 'checkinapp',
  resave: false,
  saveUninitialized: true,
}));

const checkinStreamKey = redis.getKeyName('checkins');
const maxStreamLength = config.get('checkinReceiver.maxStreamLength');

app.post(
  '/api/checkin',
  (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).send('Authentication required.');
    }

    return next();
  },
  [
    body().isObject(),
    body('userId').isInt({ min: 1 }),
    body('locationId').isInt({ min: 1 }),
    body('starRating').isInt({ min: 0, max: 5 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const checkin = req.body;
    console.log(req.session);

    // Don't (a)wait for this to finish, use callback instead.
    redisClient.xadd(
      checkinStreamKey, 'MAXLEN', '~', maxStreamLength, '*', ...Object.entries(checkin).flat(),
      (err, result) => {
        if (err) {
          logger.error('Error adding checkin to stream:');
          logger.error(err);
        } else {
          logger.debug(`Received checkin, added to stream as ${result}`);
        }
      },
    );

    // Accepted, as we'll do later processing on it...
    res.status(202).end();
  },
);

const port = config.get('checkinReceiver.port');
app.listen(port, () => {
  logger.info(`Checkin receiver listening on port ${port}.`);
});
