const config = require('better-config');
const express = require('express');
const { body } = require('express-validator');
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

app.post(
  '/login',
  [
    body().isObject(),
    body('email').isEmail(),
    body('password').isString(),
    apiErrorReporter,
  ],
  async (req, res) => {
    // TODO some stuff
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
      res.send('OK');
    } else {
      res.status(401).send('Invalid login.');
    }
  },
);

const port = config.get('auth.port');
app.listen(port, () => {
  logger.info(`Authentication service listening on port ${port}.`);
});
