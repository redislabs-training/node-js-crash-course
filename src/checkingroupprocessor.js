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

      const userKey = redis.getKeyName('users', checkin.userId);
      const locationKey = redis.getKeyName('locations', checkin.locationId);

      logger.debug(`${consumerName}: Updating user ${userKey} and location ${locationKey}.`);

      /* eslint-disable no-await-in-loop */
      await redisClient.processCheckin(
        userKey, locationKey, checkin.timestamp, checkin.locationId, checkin.starRating,
      );
      /* eslint-enable */

      let pipeline = redisClient.pipeline();

      // TODO this needs to be done in Lua because we have to check the lastCheckin and only
      // update lastCheckin and lastSeenAt if this checkin's timestamp is > current lastCheckin.
      pipeline.hset(userKey, 'lastCheckin', checkin.timestamp, 'lastSeenAt', checkin.locationId);

      // These are safe as hincrby is atomic, so other instances of the consumer updating
      // them won't be a problem.
      pipeline.hincrby(userKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numStars', checkin.starRating);

      /* eslint-disable no-await-in-loop */
      const responses = await pipeline.exec();
      /* eslint-enable */

      // Calculate new averageStars... using the 3rd and 4th response
      // values from the pipeline (location numCheckins and location numStars).
      // TODO how to handle this
      const locationNumCheckins = responses[2][1];
      const locationNumStars = responses[3][1];

      const newAverageStars = Math.round(locationNumStars / locationNumCheckins);

      pipeline = redisClient.pipeline();
      pipeline.hset(locationKey, 'averageStars', newAverageStars);

      /* eslint-disable no-await-in-loop */
      await pipeline.exec();

      // Pretend to do some time consuming work on this checkin...
      logger.info(`${consumerName}: Pausing to simulate work.`);
      await sleep.randomSleep(5, 30);

      // Acknowledge that we have processed this entry.
      const ack = await redisClient.xack(checkinStreamKey, CONSUMER_GROUP_NAME, checkin.id);
      /* eslint-enable */

      logger.info(`${consumerName}: ${ack === 1 ? 'Acknowledged' : 'Error acknowledging'} processing of checkin ${checkin.id}.`);
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
