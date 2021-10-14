const bcrypt = require('bcrypt');
const config = require('better-config');

config.set(`../../${process.env.CRASH_COURSE_CONFIG_FILE || 'config.json'}`);

const redis = require('./redisclient');

const redisClient = redis.getClient();

const CONSUMER_GROUP_NAME = 'checkinConsumers';

const usage = () => {
  console.error('Usage: npm run load users|locations|locationdetails|checkins|indexes|bloom|all');
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

  // Hash the passwords...
  /* eslint-disable array-callback-return, no-param-reassign */
  usersJSON.users.map((user) => {
    user.password = bcrypt.hashSync(user.password, 5);
  });
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

  console.log('Creating consumer group...');
  pipeline = redisClient.pipeline();

  pipeline.xgroup('DESTROY', streamKeyName, CONSUMER_GROUP_NAME);
  pipeline.xgroup('CREATE', streamKeyName, CONSUMER_GROUP_NAME, 0);
  await pipeline.exec();
  console.log('Consumer group created.');
};

const createIndexes = async () => {
  console.log('Dropping any existing indexes, creating new indexes...');

  const usersIndexKey = redis.getKeyName('usersidx');
  const locationsIndexKey = redis.getKeyName('locationsidx');

  const pipeline = redisClient.pipeline();
  pipeline.call('FT.DROPINDEX', usersIndexKey);
  pipeline.call('FT.DROPINDEX', locationsIndexKey);
  pipeline.call('FT.CREATE', usersIndexKey, 'ON', 'HASH', 'PREFIX', '1', redis.getKeyName('users'), 'SCHEMA', 'email', 'TAG', 'numCheckins', 'NUMERIC', 'SORTABLE', 'lastSeenAt', 'NUMERIC', 'SORTABLE', 'lastCheckin', 'NUMERIC', 'SORTABLE', 'firstName', 'TEXT', 'lastName', 'TEXT');
  pipeline.call('FT.CREATE', locationsIndexKey, 'ON', 'HASH', 'PREFIX', '1', redis.getKeyName('locations'), 'SCHEMA', 'category', 'TAG', 'SORTABLE', 'location', 'GEO', 'SORTABLE', 'numCheckins', 'NUMERIC', 'SORTABLE', 'numStars', 'NUMERIC', 'SORTABLE', 'averageStars', 'NUMERIC', 'SORTABLE');

  const responses = await pipeline.exec();

  if (responses.length === 4 && responses[2][1] === 'OK' && responses[3][1] === 'OK') {
    console.log('Created indexes.');
  } else {
    console.log('Unexpected error creating indexes :(');
    console.log(responses);
  }
};

const createBloomFilter = async () => {
  console.log('Deleting any previous bloom filter, creating new bloom filter...');

  const bloomFilterKey = redis.getKeyName('checkinfilter');

  const pipeline = redisClient.pipeline();
  pipeline.del(bloomFilterKey);
  pipeline.call('BF.RESERVE', bloomFilterKey, 0.0001, 1000000);

  const responses = await pipeline.exec();

  if (responses.length === 2 && responses[1][1] === 'OK') {
    console.log('Created bloom filter.');
  } else {
    console.log('Unexpected error creating bloom filter :(');
    console.log(responses);
  }
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
    case 'indexes':
      await createIndexes();
      break;
    case 'bloom':
      await createBloomFilter();
      break;
    case 'all':
      await loadUsers();
      await loadLocations();
      await loadLocationDetails();
      await loadCheckins();
      await createIndexes();
      await createBloomFilter();
      break;
    default:
      usage();
  }

  redisClient.quit();
};

runDataLoader(process.argv);
