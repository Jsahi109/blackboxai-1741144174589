const fs = require('fs').promises;
const { stringify } = require('csv-stringify/sync');
const DownloadModel = require('../models/downloadModel');
const DispositionModel = require('../models/dispositionModel');
const MasterModel = require('../models/masterModel');

exports.getDownloadForm = async (req, res) => {
    try {
        // Get disposition types for filtering
        const dispositionTypes = await DispositionModel.getDispositionTypes();
        
        // Get recent downloads history
        const downloadHistory = await DownloadModel.getDownloadHistory(10);

        // Get unique vendors
        const vendors = await MasterModel.getUniqueVendors();

        res.render('download', {
            layout: 'layouts/main',
            dispositionTypes,
            downloadHistory,
            vendors,
            error: null
        });
    } catch (error) {
        console.error('Error loading download form:', error);
        res.status(500).render('error', {
            layout: 'layouts/main',
            message: 'Error loading download form',
            error: error.message
        });
    }
};

exports.downloadData = async (req, res) => {
    try {
        const {
            fileName,
            zipCodes,
            cities,
            counties,
            regions,
            vendorName,
            dispositionAction,
            dispositions
        } = req.body;

        // Validate required fields
        if (!fileName) {
            throw new Error('File name is required');
        }

        // Process geographic filters
        const filters = {
            zipCodes: zipCodes ? zipCodes.split(',').map(zip => zip.trim()) : [],
            cities: cities ? cities.split(',').map(city => city.trim()) : [],
            counties: counties ? counties.split(',').map(county => county.trim()) : [],
            regions: regions ? regions.split(',').map(region => region.trim()) : [],
            vendorName: vendorName || null
        };

        // Process dispositions based on action
        const includeDispositions = dispositionAction === 'include' ? dispositions || [] : [];
        const excludeDispositions = dispositionAction === 'exclude' ? dispositions || [] : [];

        // Get filtered data
        const records = await DownloadModel.getFilteredData({
            ...filters,
            includeDispositions,
            excludeDispositions
        });

        if (records.length === 0) {
            throw new Error('No records found matching the specified criteria');
        }

        // Convert records to CSV
        const csv = stringify(records, {
            header: true,
            columns: [
                'first_name',
                'last_name',
                'phone1',
                'phone2',
                'phone3',
                'phone4',
                'address1',
                'address2',
                'city',
                'state',
                'region',
                'zipcode',
                'lat',
                'lon'
            ]
        });

        // Save download history
        await DownloadModel.createDownloadRecord(
            fileName,
            records.length,
            {
                ...filters,
                dispositionAction,
                dispositions
            },
            'system' // TODO: Replace with actual user ID when authentication is implemented
        );

        // Set response headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);

        // Send the CSV file
        res.send(csv);
    } catch (error) {
        console.error('Error downloading data:', error);
        res.status(500).render('error', {
            layout: 'layouts/main',
            message: 'Error downloading data',
            error: error.message
        });
    }
};

exports.redownload = async (req, res) => {
    try {
        const { id } = req.params;

        // Get download record
        const download = await DownloadModel.getDownloadById(id);
        if (!download) {
            throw new Error('Download record not found');
        }

        // Get filtered data using saved filters
        const records = await DownloadModel.getFilteredData({
            zipCodes: download.filters.zipCodes || [],
            cities: download.filters.cities || [],
            counties: download.filters.counties || [],
            regions: download.filters.regions || [],
            vendorName: download.filters.vendorName,
            includeDispositions: download.filters.dispositionAction === 'include' ? download.filters.dispositions : [],
            excludeDispositions: download.filters.dispositionAction === 'exclude' ? download.filters.dispositions : []
        });

        if (records.length === 0) {
            throw new Error('No records found matching the saved criteria');
        }

        // Convert records to CSV
        const csv = stringify(records, {
            header: true,
            columns: [
                'first_name',
                'last_name',
                'phone1',
                'phone2',
                'phone3',
                'phone4',
                'address1',
                'address2',
                'city',
                'state',
                'region',
                'zipcode',
                'lat',
                'lon'
            ]
        });

        // Set response headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${download.file_name}.csv"`);

        // Send the CSV file
        res.send(csv);
    } catch (error) {
        console.error('Error re-downloading data:', error);
        res.status(500).render('error', {
            layout: 'layouts/main',
            message: 'Error re-downloading data',
            error: error.message
        });
    }
};

exports.deleteDownload = async (req, res) => {
    try {
        const { id } = req.params;
        const success = await DownloadModel.deleteDownload(id);
        
        if (!success) {
            throw new Error('Download record not found');
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting download:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
