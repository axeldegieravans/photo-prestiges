const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    service: 'api-gateway',
    status: 'ok'
  });
});

module.exports = router;