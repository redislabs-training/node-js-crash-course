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

app.post(
  '/login',
  [
    body().isObject(),
    body('email').isEmail(),
    body('password').isString(),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { email, password } = req.body;

    // See if the correct password for this email was provided...

    // Need to escape . and @ in the email address when searching.
    /* eslint-disable no-useless-escape */
    const emailAddress = email.replace(/\./g, '\\.').replace(/\@/g, '\\@');
    /* eslint-enable */
    const searchResults = await redis.performSearch('usersidx', `@email:{${emailAddress}}`, 'RETURN', '1', 'password');

    // Valid searchResults looks like [ { password: 'ssssh' } ]
    const validLogin = searchResults.length === 1 && searchResults[0].password === password;

    if (validLogin) {
      // TODO do something...
      logger.info(`Successful login for ${email}.`);
      req.session.user = email;
      res.send('OK');
    } else {
      logger.info(`Failed login attempt for ${email}.`);
      res.status(401).send('Invalid login.');
    }
  },
);

app.get(
  '/logout',
  (req, res) => {
    const { user } = req.session;

    req.session.destroy((err) => {
      if (err) {
        logger.error('Error performing logout:');
        logger.error(err);
      } else if (user) {
        logger.info(`Logged out user ${user}.`);
      } else {
        logger.info('Logout called by a user without a session.');
      }
    });

    res.send('OK');
  },
);

const port = config.get('auth.port');
app.listen(port, () => {
  logger.info(`Authentication service listening on port ${port}.`);
});
