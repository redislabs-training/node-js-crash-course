const config = require('better-config');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const logger = require('./utils/logger');

config.set('../config.json');

const app = express();
app.use(morgan('combined', { stream: logger.stream }));
app.use(cors());
app.use('/api', routes);

const port = config.get('application.port');
app.listen(port, () => {
  console.log(`Application listening on port ${port}.`);
});
