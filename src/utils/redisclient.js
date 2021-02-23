const Redis = require('ioredis');
const config = require('better-config');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

module.exports = {
  getClient: () => redis,
  getKeyName: (...args) => `${config.redis.keyPrefix}:${args.join(':')}`,
};
