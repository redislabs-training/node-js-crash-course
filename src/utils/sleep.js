module.exports = {
  sleep: (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
  randomSleep: (min, max) => new Promise(
    (resolve) => setTimeout(
      resolve,
      (Math.ceil(Math.random() * (max - min) + min)) * 1000,
    ),
  ),
};
