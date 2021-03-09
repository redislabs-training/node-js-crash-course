module.exports = {
  sleep: (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
};
