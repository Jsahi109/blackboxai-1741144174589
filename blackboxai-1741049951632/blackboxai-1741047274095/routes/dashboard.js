const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET dashboard page
router.get('/', dashboardController.getDashboard);

// GET dashboard stats
router.get('/stats', dashboardController.getStats);

// GET geographic distribution
router.get('/geographic', dashboardController.getGeographicDistribution);

// GET vendor performance
router.get('/vendors', dashboardController.getVendorPerformance);

module.exports = router;
