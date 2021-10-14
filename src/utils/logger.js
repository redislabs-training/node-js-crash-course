const winston = require('winston');
const config = require('better-config');

config.set(`../../${process.env.CRASH_COURSE_CONFIG_FILE || 'config.json'}`);

const logger = winston.createLogger({
  level: config.get('logLevel'),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

logger.stream = {
  write: (message) => {
    // Remove double newline issue with piping morgan server request
    // log through Winston logger.
    logger.info(message.length > 0 ? message.substring(0, message.length - 1) : message);
  },
};

module.exports = logger;
