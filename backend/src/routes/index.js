const express = require('express');
const authRoutes = require('./authRoutes');
const assetRoutes = require('./assetRoutes');
const issueRoutes = require('./issueRoutes');
const historyRoutes = require('./historyRoutes');
const userRoutes = require('./userRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/assets', assetRoutes);
router.use('/issues', issueRoutes);
router.use('/history', historyRoutes);
router.use('/users', userRoutes);

module.exports = router;
