const redis = require('./utils/redisclient');
const logger = require('./utils/logger');
const sleep = require('./utils/sleep');

const runCheckinProcessor = async () => {
  const redisClient = redis.getClient();
  const checkinStreamKey = redis.getKeyName('checkins');
  const checkinProcessorIdKey = redis.getKeyName('checkinprocessor', 'lastid');
  const delay = process.argv[3] === 'delay';

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

    // If a stream entry was read, response looks like:
    // [
    //   [ "ncc:checkins",
    //     [
    //       [ "1609602085397-0",
    //         [ "locationId","171","userId","789","starRating","5" ]
    //       ]
    //     ]
    //   ]
    // ]

    if (response) {
      const checkinData = response[0][1][0];
      const fieldNamesAndValues = checkinData[1];

      const checkin = {
        id: checkinData[0],
        timestamp: checkinData[0].split('-')[0],
      };

      for (let n = 0; n < fieldNamesAndValues.length; n += 2) {
        const k = fieldNamesAndValues[n];
        const v = fieldNamesAndValues[n + 1];
        checkin[k] = v;
      }

      const userKey = redis.getKeyName('users', checkin.userId);
      const locationKey = redis.getKeyName('locations', checkin.locationId);

      logger.debug(`Updating user ${userKey} and location ${locationKey}.`);

      let pipeline = redisClient.pipeline();

      pipeline.hset(userKey, 'lastCheckin', checkin.timestamp, 'lastSeenAt', checkin.locationId);
      pipeline.hincrby(userKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numCheckins', 1);
      pipeline.hincrby(locationKey, 'numStars', checkin.starRating);

      /* eslint-disable no-await-in-loop */
      const responses = await pipeline.exec();
      /* eslint-enable */

      // Calculate new averageStars... using the 3rd and 4th response
      // values from the pipeline (location numCheckins and location numStars).
      const locationNumCheckins = responses[2][1];
      const locationNumStars = responses[3][1];

      const newAverageStars = Math.round(locationNumStars / locationNumCheckins);
      lastIdRead = checkin.id;

      pipeline = redisClient.pipeline();
      pipeline.hset(locationKey, 'averageStars', newAverageStars);
      pipeline.set(checkinProcessorIdKey, lastIdRead);

      /* eslint-disable no-await-in-loop */
      await pipeline.exec();
      /* eslint-enable */

      logger.info(`Processed checkin ${checkin.id}.`);

      // Simulate some time consuming "work"...
      if (delay) {
        /* eslint-disable no-await-in-loop */
        await sleep.randomSleep(1, 10);
        /* eslint-enable */
      }
      /* eslint-enable */
    } else {
      logger.info('Waiting for more checkins...');
    }
  }
};

runCheckinProcessor();
