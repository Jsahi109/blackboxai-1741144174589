const multer = require('multer');
const path = require('path');
const csv = require('csv-parser');
const fs = require('fs');
const MasterModel = require('../models/masterModel');

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

exports.getUploadForm = async (req, res) => {
    try {
        const recentUploads = await MasterModel.getRecentUploads(10);
        res.render('upload', {
            layout: 'layouts/main',
            error: null,
            success: null,
            recentUploads: recentUploads || []
        });
    } catch (error) {
        console.error('Error loading upload form:', error);
        res.render('upload', {
            layout: 'layouts/main',
            error: 'Error loading recent uploads',
            success: null,
            recentUploads: []
        });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        upload(req, res, async (err) => {
            if (err) {
                return res.render('upload', {
                    layout: 'layouts/main',
                    error: err.message
                });
            }

            if (!req.file) {
                return res.render('upload', {
                    layout: 'layouts/main',
                    error: 'Please select a file to upload'
                });
            }

            const uploadRecord = await MasterModel.createUploadRecord({
                filename: req.file.filename,
                original_filename: req.file.originalname,
                vendor_name: req.body.vendor,
                file_size: req.file.size,
                file_path: req.file.path,
                uploaded_by: 'system'
            });

            // Read CSV headers
            const headers = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('headers', async (csvHeaders) => {
                    await MasterModel.updateUploadRecord(uploadRecord.id, {
                        headers: csvHeaders,
                        status: 'processing'
                    });

                    res.redirect(`/upload/map?id=${uploadRecord.id}`);
                })
                .on('error', async (error) => {
                    await MasterModel.updateUploadRecord(uploadRecord.id, {
                        status: 'failed',
                        error_message: error.message
                    });

                    res.render('upload', {
                        layout: 'layouts/main',
                        error: 'Error reading CSV file: ' + error.message
                    });
                });
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.render('upload', {
            layout: 'layouts/main',
            error: 'Error uploading file: ' + error.message
        });
    }
};

exports.getMapFields = async (req, res) => {
    try {
        const uploadId = req.query.id;
        const upload = await MasterModel.getUploadById(uploadId);
        
        if (!upload) {
            return res.render('error', {
                layout: 'layouts/main',
                message: 'Upload not found',
                error: 'The requested upload record does not exist'
            });
        }

        const columnNames = await MasterModel.getColumnNames();
        const sampleData = {};

        // Get sample data from first row
        await new Promise((resolve, reject) => {
            let firstRow = true;
            fs.createReadStream(upload.file_path)
                .pipe(csv())
                .on('data', (row) => {
                    if (firstRow) {
                        Object.keys(row).forEach(header => {
                            sampleData[header] = row[header];
                        });
                        firstRow = false;
                        resolve();
                    }
                })
                .on('error', reject);
        });

        res.render('mapFields', {
            layout: 'layouts/main',
            fileId: uploadId,
            vendorName: upload.vendor_name,
            originalFilename: upload.original_filename,
            totalRows: 0, // This will be calculated during processing
            csvHeaders: upload.headers,
            columnNames,
            sampleData,
            error: null
        });
    } catch (error) {
        console.error('Error loading map fields form:', error);
        res.render('error', {
            layout: 'layouts/main',
            message: 'Error loading field mapping',
            error: error.message
        });
    }
};

exports.processMapping = async (req, res) => {
    const { fileId, mapping } = req.body;
    let totalRows = 0;
    let successfulRows = 0;
    let duplicateRows = 0;
    let failedRows = 0;

    try {
        const upload = await MasterModel.getUploadById(fileId);
        if (!upload) {
            throw new Error('Upload record not found');
        }

        // Update upload record with mapping
        await MasterModel.updateUploadRecord(fileId, {
            mapping: mapping,
            status: 'processing'
        });

        // Process CSV file
        const records = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(upload.file_path)
                .pipe(csv())
                .on('data', (row) => {
                    totalRows++;
                    const mappedRecord = {};
                    Object.entries(mapping).forEach(([csvField, dbField]) => {
                        if (dbField) {
                            mappedRecord[dbField] = row[csvField];
                        }
                    });
                    records.push(mappedRecord);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Process records in batches
        const batchSize = 1000;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            
            // Check for duplicates
            const phoneNumbers = batch
                .map(r => r.phone1)
                .filter(Boolean);
            
            const duplicates = await MasterModel.checkDuplicatePhones(phoneNumbers);
            
            // Process each record
            for (const record of batch) {
                try {
                    if (!record.phone1) {
                        failedRows++;
                        continue;
                    }

                    if (duplicates.includes(record.phone1)) {
                        duplicateRows++;
                        continue;
                    }

                    await MasterModel.insertMasterRecord(record, upload.vendor_name);
                    successfulRows++;
                } catch (error) {
                    console.error('Error inserting record:', error);
                    failedRows++;
                }
            }

            // Update progress
            await MasterModel.updateUploadRecord(fileId, {
                total_records: totalRows,
                successful_records: successfulRows,
                duplicates_count: duplicateRows,
                failed_records: failedRows
            });
        }

        // Mark upload as completed
        await MasterModel.updateUploadRecord(fileId, {
            status: 'completed'
        });

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error processing mapping:', error);
        
        // Update upload record with error
        await MasterModel.updateUploadRecord(fileId, {
            status: 'failed',
            error_message: error.message
        });

        res.render('error', {
            layout: 'layouts/main',
            message: 'Error processing file',
            error: error.message
        });
    }
};
