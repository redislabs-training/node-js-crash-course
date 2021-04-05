const fs = require('fs');
const redis = require('./utils/redisclient');
const logger = require('./utils/logger');
const sleep = require('./utils/sleep');

const CONSUMER_GROUP_NAME = 'checkinConsumers';
const redisClient = redis.getClient();

const loadLuaScript = async () => {
  redisClient.defineCommand('processCheckin', {
    numberOfKeys: 2,
    lua: fs.readFileSync('src/scripts/checkinprocessor.lua').toString(),
  });
};

const runCheckinGroupProcessor = async (consumerName) => {
  logger.info(`${consumerName}: Starting up.`);

  loadLuaScript();

  const checkinStreamKey = redis.getKeyName('checkins');

  /* eslint-disable no-constant-condition */
  while (true) {
    /* eslint-enable */
    /* eslint-disable no-await-in-loop */
    const response = await redisClient.xreadgroup('GROUP', CONSUMER_GROUP_NAME, consumerName, 'COUNT', '1', 'BLOCK', '5000', 'STREAMS', checkinStreamKey, '>');
    /* eslint-enable */

    if (response) {
      // Response looks like this:
      //
      // [
      //   [
      //     "ncc:checkins",
      //     [
      //       ["1609603711960-0",["locationId","181","userId","455","starRating","5"]]
      //     ]
      //   ]
      // ]
      const streamEntry = response[0][1][0];
      const fieldNamesAndValues = streamEntry[1];

      const checkin = {
        id: streamEntry[0],
        timestamp: streamEntry[0].split('-')[0],
      };

      logger.info(`${consumerName}: Processing checkin ${checkin.id}.`);

      for (let n = 0; n < fieldNamesAndValues.length; n += 2) {
        const k = fieldNamesAndValues[n];
        const v = fieldNamesAndValues[n + 1];
        checkin[k] = v;
      }

      const checkinId = checkin.id;
      const userKey = redis.getKeyName('users', checkin.userId);
      const locationKey = redis.getKeyName('locations', checkin.locationId);

      logger.debug(`${consumerName}: Processing ${checkinId}.`);
      logger.debug(`${consumerName}: Updating user ${userKey} and location ${locationKey}.`);

      /* eslint-disable no-await-in-loop */
      await redisClient.processCheckin(
        userKey, locationKey, checkin.timestamp, checkin.locationId, checkin.starRating,
      );

      // Acknowledge that we have processed this entry.
      const ack = await redisClient.xack(checkinStreamKey, CONSUMER_GROUP_NAME, checkinId);

      logger.info(`${consumerName}: ${ack === 1 ? 'Acknowledged' : 'Error acknowledging'} processing of checkin ${checkinId}.`);

      // Pretend to do something that takes time...
      logger.info(`${consumerName}: Pausing to simulate work.`);
      await sleep.randomSleep(1, 5);
      /* eslint-enable */
    } else {
      logger.info(`${consumerName}: waiting for more checkins...`);
    }
  }
};

if (process.argv.length !== 3) {
  logger.error('Usage: npm run checkingroupprocessor <consumerName>');
  process.exit(1);
}

runCheckinGroupProcessor(process.argv[2]);
