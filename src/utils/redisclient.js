const Redis = require('ioredis');
const config = require('better-config');

config.set('../../config.json');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

module.exports = {
  getClient: () => redis,
  getKeyName: (...args) => `${config.redis.keyPrefix}:${args.join(':')}`,
};
