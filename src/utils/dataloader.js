const config = require('better-config');

config.set('../../config.json');

const redis = require('./redisclient');

const redisClient = redis.getClient();

const usage = () => {
  console.error('Usage: npm run load users|locations|locationdetails|checkins|all');
  process.exit(0);
};

const loadData = async (jsonArray, keyName) => {
  const pipeline = redisClient.pipeline();

  for (const obj of jsonArray) {
    pipeline.hset(redis.getKeyName(keyName, obj.id), obj);
  }

  const responses = await pipeline.exec();
  let errorCount = 0;

  for (const response of responses) {
    if (response[0] !== null) {
      errorCount += 1;
    }
  }

  return errorCount;
};

const loadUsers = async () => {
  console.log('Loading user data...');
  /* eslint-disable global-require */
  const usersJSON = require('../../data/users.json');
  /* eslint-enable */

  const errorCount = await loadData(usersJSON.users, 'users');
  console.log(`User data loaded with ${errorCount} errors.`);
};

const loadLocations = async () => {
  console.log('Loading location data...');
  /* eslint-disable global-require */
  const locationsJSON = require('../../data/locations.json');
  /* eslint-enable */

  const errorCount = await loadData(locationsJSON.locations, 'locations');
  console.log(`Location data loaded with ${errorCount} errors.`);
};

const loadLocationDetails = async () => {
  console.log('Loading location details...');
  /* eslint-disable global-require */
  const locationsJSON = require('../../data/locationdetails.json');
  /* eslint-enable */

  const pipeline = redisClient.pipeline();

  for (const locationDetail of locationsJSON.locationDetails) {
    pipeline.call('JSON.SET', redis.getKeyName('locationdetails', locationDetail.id), '.', JSON.stringify(locationDetail));
  }

  const responses = await pipeline.exec();

  let errorCount = 0;

  for (const response of responses) {
    if (response[0] !== null && response[1] !== 'OK') {
      errorCount += 1;
    }
  }

  console.log(`Location detail data loaded with ${errorCount} errors.`);
};

const loadCheckins = async () => {
  console.log('Loading checkin stream entries...');

  /* eslint-disable global-require */
  const { checkins } = require('../../data/checkins.json');
  /* eslint-enable */

  const streamKeyName = redis.getKeyName('checkins');

  // Delete any previous stream.
  await redisClient.del(streamKeyName);

  // Batch load entries 100 at a time.
  let n = 0;
  let pipeline = redisClient.pipeline();

  /* eslint-disable no-await-in-loop */
  do {
    const checkin = checkins[n];
    pipeline.xadd(streamKeyName, checkin.id, 'locationId', checkin.locationId, 'userId', checkin.userId, 'starRating', checkin.starRating);
    n += 1;

    if (n % 100 === 0) {
      // Send 100 XADD commands to Redis.
      await pipeline.exec();

      // Start a fresh pipeline.
      pipeline = redisClient.pipeline();
    }
  } while (n < checkins.length);
  /* eslint-enable */

  // Send any remaining checkins if the number of checkins in the
  // file wasn't divisible by 100.
  if (pipeline.length > 0) {
    await pipeline.exec();
  }

  const numEntries = await redisClient.xlen(streamKeyName);
  console.log(`Loaded ${numEntries} checkin stream entries.`);
};

const runDataLoader = async (params) => {
  if (params.length !== 4) {
    usage();
  }

  const command = params[3];

  switch (command) {
    case 'users':
      await loadUsers();
      break;
    case 'locations':
      await loadLocations();
      break;
    case 'locationdetails':
      await loadLocationDetails();
      break;
    case 'checkins':
      await loadCheckins();
      break;
    case 'all':
      await loadUsers();
      await loadLocations();
      await loadLocationDetails();
      await loadCheckins();
      break;
    default:
      usage();
  }

  redisClient.quit();
};

runDataLoader(process.argv);
