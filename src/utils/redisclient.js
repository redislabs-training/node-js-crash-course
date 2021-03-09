const Redis = require('ioredis');
const config = require('better-config');

config.set('../../config.json');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

const performSearch = async (index, ...query) => {
  try {
    const searchResults = await redis.call('FT.SEARCH', index, query);

    // An empty search result looks like [ 0 ].
    if (searchResults.length === 1) {
      return [];
    }

    // Actual results look like:
    //
    // [ 3, 'hashKey', ['fieldName', 'fieldValue', ...],
    //      'hashKey', ['fieldName, 'fieldValue', ...], ... ]

    const results = [];
    for (let n = 2; n < searchResults.length; n += 2) {
      const result = {};
      const fieldNamesAndValues = searchResults[n];

      for (let m = 0; m < fieldNamesAndValues.length; m += 2) {
        const k = fieldNamesAndValues[m];
        const v = fieldNamesAndValues[m + 1];
        result[k] = v;
      }

      results.push(result);
    }

    return results;
  } catch (e) {
    // A malformed query or unknown index etc causes an exception type error.
    // TODO ERROR LOG THIS...
    return [];
  }
};

module.exports = {
  getClient: () => redis,
  getKeyName: (...args) => `${config.redis.keyPrefix}:${args.join(':')}`,
  performSearch,
};
