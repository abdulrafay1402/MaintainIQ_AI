const express = require('express');
const { getAssetHistory } = require('../controllers/historyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/asset/:id', protect, getAssetHistory);

module.exports = router;
