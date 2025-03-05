const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const DispositionModel = require('../models/dispositionModel');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
}).single('file');

exports.getDispositionsPage = async (req, res) => {
    try {
        const dispositionTypes = await DispositionModel.getDispositionTypes();
        const summary = await DispositionModel.getDispositionSummary();
        const recent = await DispositionModel.getRecentDispositions(10);

        res.render('dispositions', {
            layout: 'layouts/main',
            types: dispositionTypes,
            dispositionTypes: dispositionTypes,
            summary,
            recent,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading dispositions page:', error);
        res.render('error', {
            layout: 'layouts/main',
            message: 'Error loading dispositions',
            error: error.message
        });
    }
};

exports.uploadDispositions = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Please select a file to upload'
                });
            }

            const records = [];
            const requiredColumns = ['phone_number', 'disposition_type'];
            let headers = null;

            // Read CSV file
            await new Promise((resolve, reject) => {
                fs.createReadStream(req.file.path)
                    .pipe(csv())
                    .on('headers', (csvHeaders) => {
                        headers = csvHeaders;
                        // Check for required columns
                        const missingColumns = requiredColumns.filter(col => !csvHeaders.includes(col));
                        if (missingColumns.length > 0) {
                            reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
                        }
                    })
                    .on('data', (row) => {
                        records.push({
                            phone_number: row.phone_number,
                            disposition_type: row.disposition_type,
                            notes: row.notes || null
                        });
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Validate phone numbers
            const phoneNumbers = records.map(r => r.phone_number);
            const validPhoneNumbers = await DispositionModel.validatePhoneNumbers(phoneNumbers);
            
            // Filter out records with invalid phone numbers
            const validRecords = records.filter(r => validPhoneNumbers.includes(r.phone_number));

            if (validRecords.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid records found in the CSV file'
                });
            }

            // Add dispositions
            await DispositionModel.addDispositions(validRecords, req.body.created_by || 'system');

            // Clean up uploaded file
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });

            res.json({
                success: true,
                message: `Successfully processed ${validRecords.length} dispositions`,
                totalRecords: records.length,
                validRecords: validRecords.length,
                invalidRecords: records.length - validRecords.length
            });
        });
    } catch (error) {
        console.error('Error uploading dispositions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.addDisposition = async (req, res) => {
    try {
        const { phone_number, disposition_type, notes } = req.body;

        if (!phone_number || !disposition_type) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and disposition type are required'
            });
        }

        // Validate phone number
        const validPhoneNumbers = await DispositionModel.validatePhoneNumbers([phone_number]);
        if (validPhoneNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number or phone number not found in records'
            });
        }

        await DispositionModel.addDisposition(
            phone_number,
            disposition_type,
            notes,
            req.body.created_by || 'system'
        );

        res.json({
            success: true,
            message: 'Disposition added successfully'
        });
    } catch (error) {
        console.error('Error adding disposition:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getDispositionByPhone = async (req, res) => {
    try {
        const { phone } = req.params;
        const disposition = await DispositionModel.getDispositionByPhone(phone);

        if (!disposition) {
            return res.status(404).json({
                success: false,
                error: 'Disposition not found'
            });
        }

        res.json({
            success: true,
            disposition
        });
    } catch (error) {
        console.error('Error getting disposition:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteDisposition = async (req, res) => {
    try {
        const { phone } = req.params;
        const success = await DispositionModel.deleteDisposition(phone);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Disposition not found'
            });
        }

        res.json({
            success: true,
            message: 'Disposition deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting disposition:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
