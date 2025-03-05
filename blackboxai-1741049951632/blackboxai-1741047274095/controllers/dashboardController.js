const MasterModel = require('../models/masterModel');
const DispositionModel = require('../models/dispositionModel');

exports.getDashboard = async (req, res) => {
    try {
        // Get total records stats
        const recordStats = await MasterModel.getTotalRecords();
        
        // Get vendor stats
        const vendorStats = await MasterModel.getVendorStats();
        
        // Get disposition stats
        const dispositionStats = await DispositionModel.getDispositionStats();
        
        // Get disposition summary
        const dispositionSummary = await DispositionModel.getDispositionSummary();
        
        // Get vendor performance
        const vendorPerformance = await MasterModel.getVendorPerformance();
        
        // Get geographic distribution
        const geographicData = await MasterModel.getGeographicDistribution();

        // Mock recent activity data since we don't have an activity tracking table yet
        const recentActivity = [
            {
                type: 'upload',
                description: 'New data uploaded',
                metadata: '1,000 records processed',
                timeFormatted: '2:30 PM',
                dateFormatted: 'Today'
            },
            {
                type: 'download',
                description: 'Data export',
                metadata: 'Filter: Region - West',
                timeFormatted: '11:45 AM',
                dateFormatted: 'Today'
            },
            {
                type: 'disposition',
                description: 'Bulk disposition update',
                metadata: '50 records marked as DNC',
                timeFormatted: '9:15 AM',
                dateFormatted: 'Today'
            }
        ];

        // Calculate growth rates
        const recordsGrowth = 15; // Mock growth rate
        const dispositionsGrowth = 8; // Mock growth rate

        res.render('dashboard', {
            layout: 'layouts/main',
            stats: {
                totalRecords: recordStats.count || 0,
                duplicateRate: recordStats.count > 0 
                    ? ((recordStats.duplicates / recordStats.count) * 100).toFixed(1)
                    : 0,
                activeVendors: vendorStats.activeCount || 0,
                recordsGrowth,
                dispositionsGrowth,
                totalVendors: vendorStats.totalCount || 0,
                todayDispositions: dispositionStats.todayCount || 0,
                totalDuplicates: recordStats.duplicates || 0
            },
            dispositionSummary,
            vendorPerformance,
            geographicData,
            recentActivity,
            geoDistribution: {
                labels: Array.isArray(geographicData) ? geographicData.map(item => item.name) : [],
                data: Array.isArray(geographicData) ? geographicData.map(item => item.count) : []
            },
            error: null
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('error', {
            layout: 'layouts/main',
            message: 'Error loading dashboard',
            error: error.message
        });
    }
};

exports.getStats = async (req, res) => {
    try {
        const recordStats = await MasterModel.getTotalRecords();
        const vendorStats = await MasterModel.getVendorStats();
        const dispositionStats = await DispositionModel.getDispositionStats();

        res.json({
            totalRecords: recordStats.count,
            duplicateRate: recordStats.count > 0 
                ? ((recordStats.duplicates / recordStats.count) * 100).toFixed(1)
                : 0,
            activeVendors: vendorStats.activeCount,
            dispositionsToday: dispositionStats.todayCount,
            previousMonthRecords: recordStats.previousCount
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            error: error.message
        });
    }
};

exports.getGeographicDistribution = async (req, res) => {
    try {
        const view = req.query.view || 'region';
        const data = await MasterModel.getGeographicDistribution(view);
        res.json(data);
    } catch (error) {
        console.error('Error getting geographic distribution:', error);
        res.status(500).json({
            error: error.message
        });
    }
};

exports.getVendorPerformance = async (req, res) => {
    try {
        const data = await MasterModel.getVendorPerformance();
        res.json(data);
    } catch (error) {
        console.error('Error getting vendor performance:', error);
        res.status(500).json({
            error: error.message
        });
    }
};
