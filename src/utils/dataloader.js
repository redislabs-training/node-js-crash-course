const config = require('better-config');

config.set('../../config.json');

const redis = require('./redisclient');

const redisClient = redis.getClient();

const usage = () => {
  console.error('Usage: npm run load users|locations|all');
  process.exit(0);
};

const loadUsers = async () => {
  console.log('Loading user data...');
  /* eslint-disable global-require */
  const usersJSON = require('../../data/users.json');
  /* eslint-enable */

  const pipeline = redisClient.pipeline();

  for (const user of usersJSON.users) {
    pipeline.hset(redis.getKeyName('users', user.id), user);
  }

  const responses = await pipeline.exec();
  let errorCount = 0;

  for (const response of responses) {
    if (response[0] !== null) {
      errorCount += 1;
    }
  }

  console.log(`User data loaded with ${errorCount} errors.`);
};

const loadLocations = async () => {
  console.log('TODO load locations...');
  /* eslint-disable global-require */
  const locationsJSON = require('../../data/locations.json');
  /* eslint-enable */
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
