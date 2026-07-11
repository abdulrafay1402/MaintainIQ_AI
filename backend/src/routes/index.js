const express = require('express');
const authRoutes = require('./authRoutes');
const assetRoutes = require('./assetRoutes');
const issueRoutes = require('./issueRoutes');
const historyRoutes = require('./historyRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/assets', assetRoutes);
router.use('/issues', issueRoutes);
router.use('/history', historyRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
