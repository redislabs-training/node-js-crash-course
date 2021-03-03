const redis = require('./utils/redisclient');

const checkinStreamKey = redis.getKeyName('checkins');

const runCheckinProcessor = async () => {
  const redisClient = redis.getClient();

  // This needs to XREAD from the checkins stream, and perform the
  // following actions for each checkin read:
  //
  // * Update user lastCheckin
  // * Update user lastSeenAt
  // * Update user numCheckins
  // * Update location numCheckins
  // * Update location numStars
  // * Update location averageStars
  //
  // Also needs to remember where it got up to in the stream.

  // TODO persist this...
  let lastIdRead = '0';

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
      };

      for (let n = 0; n < fieldNamesAndValues.length; n += 2) {
        const k = fieldNamesAndValues[n];
        const v = fieldNamesAndValues[n + 1];
        checkin[k] = v;
      }

      // TODO logger and show information from checkin...
      console.log(checkin);

      // TODO do the work...

      lastIdRead = checkin.id;
    } else {
      // TODO logger...
      console.log('Waiting for more checkins...');
    }
  }
};

runCheckinProcessor();
