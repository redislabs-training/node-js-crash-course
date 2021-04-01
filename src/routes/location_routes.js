const fetch = require('node-fetch');
const router = require('express').Router();
const { param, query } = require('express-validator');
const logger = require('../utils/logger');
const redis = require('../utils/redisclient');
const apiErrorReporter = require('../utils/apierrorreporter');

const CACHE_TIME = 60 * 60; // An hour in seconds.
const redisClient = redis.getClient();

const getWeatherKey = (locationId) => redis.getKeyName('weather', locationId);

// Get location by ID, optionally with extra details.
router.get(
  '/location/:locationId',
  [
    param('locationId').isInt({ min: 1 }),
    query('withDetails').isBoolean().optional(),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { locationId } = req.params;
    const { withDetails } = req.query;

    const locationKey = redis.getKeyName('locations', locationId);

    const pipeline = redisClient.pipeline();
    pipeline.hgetall(locationKey);

    if (withDetails) {
      const locationDetailsKey = redis.getKeyName('locationdetails', locationId);
      pipeline.call('JSON.GET', locationDetailsKey);
    }

    const details = await pipeline.exec();
    const locationOverview = details[0][1];
    let response;

    if (withDetails) {
      const locationDetails = JSON.parse(details[1][1]);
      delete locationDetails.id;

      response = {
        ...locationOverview,
        ...locationDetails,
      };
    } else {
      response = locationOverview;
    }

    res.status(200).json(response);
  },
);

// EXERCISE: Get opening hours for a given day.
router.get(
  '/location/:locationId/hours/:day',
  [
    param('locationId').isInt({ min: 1 }),
    param('day').isInt({ min: 0, max: 6 }),
    apiErrorReporter,
  ],
  async (req, res) => {
    /* eslint-disable no-unused-vars */
    const { locationId, day } = req.params;
    /* eslint-enable */
    const locationDetailsKey = redis.getKeyName('locationdetails', locationId);

    // TODO: Get the opening hours for a given day from
    // the JSON stored at the key held in locationDetailsKey.
    // You will need to provide the correct JSON path to the hours
    // array and return the element held in the position specified by
    // the day variable.  Make sure RedisJSON returns only the day
    // requested!
    const jsonPath = 'TODO';

    /* eslint-enable no-unused-vars */
    const hoursForDay = JSON.parse(await redisClient.call('JSON.GET', locationDetailsKey, jsonPath));
    /* eslint-disable */

    // If null response, return empty object.
    res.status(200).json(hoursForDay || {});
  },
);

router.get(
  '/location/:locationId/details',
  [
    param('locationId').isInt({ min: 1 }),
    query('sections').isString().optional().custom((value, { req }) => {
      const { sections } = req.query;
      const validSections = ['socials', 'website', 'description', 'phone', 'hours'];
      const arrayOfSections = sections.split(',');

      for (const str of arrayOfSections) {
        if (!validSections.includes(str)) {
          throw new Error(`Invalid value ${str} for sections.`);
        }
      }

      return true;
    }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { locationId } = req.params;
    const { sections } = req.query;
    const locationDetailsKey = redis.getKeyName('locationdetails', locationId);

    let jsonPath = ['.'];
    if (sections) {
      jsonPath = sections.split(',');
    }

    const locationDetails = JSON.parse(await redisClient.call('JSON.GET', locationDetailsKey, ...jsonPath));

    // If null response, return empty object.
    res.status(200).json(locationDetails || {});
  },
);

const validateCategory = (category) => {
  const validCategories = ['retail', 'cafe', 'restaurant', 'bar', 'hair', 'gym'];

  if (!validCategories.includes(category)) {
    throw new Error(`Invalid value ${category} for category.`);
  }

  return true;
};

// Get all locations in a specified category.
router.get(
  '/locations/bycategory/:category',
  [
    param('category').isString().custom((value, { req }) => {
      const { category } = req.params;
      return validateCategory(category);
    }),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { category } = req.params;
    const searchResults = await redis.performSearch(redis.getKeyName('locationsidx'), `@category:{${category}}`);

    res.status(200).json(searchResults);
  },
);

// This should also optionally take location type and min star rating request parameters.
router.get(
  '/locations/:latitude/:longitude/:radius',
  [
    param('latitude').isFloat(),
    param('longitude').isFloat(),
    param('radius').isInt({ min: 1 }),
    query('category').isString().optional().custom((value, { req }) => {
      const { category } = req.query;
      return validateCategory(category);
    }),
    query('minStars').isInt({ min: 1, max: 5 }).optional(),
    apiErrorReporter,
  ],
  async (req, res) => {
    const { latitude, longitude, radius } = req.params;
    const { category, minStars } = req.query;

    const categoryClause = category ? `@category:{${category}}` : '';
    const minStarsClause = minStars ? `@averageStars:[${minStars} +inf]` : '';

    const searchResults = await redis.performSearch(redis.getKeyName('locationsidx'), `@location:[${longitude},${latitude} ${radius} mi] ${minStarsClause} ${categoryClause}`);

    res.status(200).json(searchResults);
  },
);

// Call an external weather API to get weather for a given location ID.
router.get(
  '/location/:locationId/weather',
  [
    param('locationId').isInt({ min: 1 }),
    apiErrorReporter,
  ],
  async (req, res, next) => {
    const { locationId } = req.params;

    const cachedWeather = await redisClient.get(getWeatherKey(locationId));

    if (cachedWeather) {
      // Cache hit!
      logger.debug(`Cache hit for location ${locationId} weather.`);
      res.status(200).json(JSON.parse(cachedWeather));
    } else {
      // Cache miss :(
      logger.debug(`Cache miss for location ${locationId} weather.`);
      next();
    }
  },
  async (req, res) => {
    const { locationId } = req.params;

    // Get the co-ordinates for this location from Redis.
    const locationKey = redis.getKeyName('locations', locationId);

    // Get lng,lat coordinates from Redis.
    const coords = await redisClient.hget(locationKey, 'location');
    let weatherJSON = {};

    // Check if the location existed in Redis and get weather if so.
    if (coords) {
      const [lng, lat] = coords.split(',');

      // Call the API.
      const apiResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?units=imperial&lat=${lat}&lon=${lng}&appid=${process.env.WEATHER_API_KEY}`);

      if (apiResponse.status === 200) {
        // Weather was retrieved OK.
        weatherJSON = await apiResponse.json();

        // Store the results in Redis and set TTL.
        redisClient.setex(getWeatherKey(locationId), CACHE_TIME, JSON.stringify(weatherJSON));

        return res.status(200).json(weatherJSON);
      }
      
      return res.status(400).send('Bad request: check your WEATHER_API_KEY!');
    }

    
  },
);

module.exports = router;
