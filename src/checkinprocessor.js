const redis = require('./utils/redisclient');
const logger = require('./utils/logger');

const runCheckinProcessor = async () => {
  const redisClient = redis.getClient();
  const checkinStreamKey = redis.getKeyName('checkins');
  const checkinProcessorIdKey = redis.getKeyName('checkinprocessor', 'lastid');

  let lastIdRead = await redisClient.get(checkinProcessorIdKey);
  if (lastIdRead == null) {
    lastIdRead = 0;
  }

  logger.info(`Reading stream from last ID ${lastIdRead}.`);

  /* eslint-disable no-constant-condition */
  while (true) {
    /* eslint-enable */
    /* eslint-disable no-await-in-loop */
    const response = await redisClient.xread('COUNT', '1', 'BLOCK', '5000', 'STREAMS', checkinStreamKey, lastIdRead);
    /* eslint-enable */

    if (response) {
      const checkinData = response[0][1][0];
      const fieldNamesAndValues = checkinData[1];

      const checkin = {
        id: checkinData[0],
        timestamp: checkinData[0].split('-')[0]
      };

      for (let n = 0; n < fieldNamesAndValues.length; n += 2) {
        const k = fieldNamesAndValues[n];
        const v = fieldNamesAndValues[n + 1];
        checkin[k] = v;
      }

      const userKey = redis.getKeyName('users', checkin.userId);
      const locationKey = redis.getKeyName('locations', checkin.locationId);

      logger.debug(`Updating user ${userKey}`);
      logger.debug(`Updating location ${locationKey}`);

      const pipeline = redisClient.pipeline();

      pipeline.hset(userKey, 'lastCheckin', checkin.timestamp, 'lastSeenAt', checkin.locationId);
      pipeline.hincrby(userKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numStars', checkin.starRating);

      const responses = await pipeline.exec();
      console.log(responses);

      // TODO calculate new averageStars...

      lastIdRead = checkin.id;
      redisClient.set(checkinProcessorIdKey, lastIdRead);

      logger.debug(`Processed checkin ${checkin.id}.`);
    } else {
      logger.info('Waiting for more checkins...');
    }
  }
};

runCheckinProcessor();
