const config = require('better-config');

config.set('../../config.json');

const redis = require('./redisclient');

const redisClient = redis.getClient();

const usage = () => {
  console.error('Usage: npm run load users|locations|all');
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
    case 'all':
      await loadUsers();
      await loadLocations();
      break;
    default:
      usage();
  }

  redisClient.quit();
};

runDataLoader(process.argv);
