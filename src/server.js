const config = require('better-config');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const logger = require('./utils/logger');

config.set(`../${process.env.CRASH_COURSE_CONFIG_FILE || 'config.json'}`);

const app = express();
app.use(morgan('combined', { stream: logger.stream }));
app.use(cors());
app.use('/api', routes);

// Check for required environment variables.
if (process.env.WEATHER_API_KEY === undefined) {
  console.warn('Warning: Environment variable WEATHER_API_KEY is not set!');
}

const port = config.get('application.port');
app.listen(port, () => {
  logger.info(`Application listening on port ${port}.`);
});
