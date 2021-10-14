const Redis = require('ioredis');
const config = require('better-config');
const logger = require('./logger');

const MAX_SEARCH_RESULTS = 1000;

config.set(`../../${process.env.CRASH_COURSE_CONFIG_FILE || 'config.json'}`);

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

const performSearch = async (index, ...query) => {
  try {
    // Return the first MAX_SEARCH_RESULTS matching documents.
    const searchResults = await redis.call('FT.SEARCH', index, query, 'LIMIT', '0', MAX_SEARCH_RESULTS);

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
    logger.error(`Invalid search request for index: ${index}, query: ${query}`);
    logger.error(e);
    return [];
  }
};

module.exports = {
  getClient: () => redis,
  getKeyName: (...args) => `${config.redis.keyPrefix}:${args.join(':')}`,
  performSearch,
};
