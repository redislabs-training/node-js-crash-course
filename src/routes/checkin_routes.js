const router = require('express').Router();

router.get(
  '/checkin/:id',
  async (req, res, next) => res.status(200).json({ status: 'TODO' }),
);

module.exports = router;
