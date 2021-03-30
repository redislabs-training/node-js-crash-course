const Redis = require('ioredis');

const redisDemo = async () => {
  // Connect to Redis at 127.0.0.1, port 6379.
  const redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379,
  });

  // Set key "myname" to have value "Simon Prickett".
  await redisClient.set('myname', 'Simon Prickett');

  // Get the value held at key "myname" and log it.
  const value = await redisClient.get('myname');
  console.log(value);

  // Disconnect from Redis.
  redisClient.quit();
};

redisDemo();
