const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');

// Download form page
router.get('/download', downloadController.getDownloadForm);

// Process download request
router.post('/download', downloadController.downloadData);

// Re-download from history
router.get('/download/:id/redownload', downloadController.redownload);

// Delete download history record
router.delete('/download/:id', downloadController.deleteDownload);

module.exports = router;
