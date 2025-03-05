const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// GET upload form
router.get('/', uploadController.getUploadForm);

// POST file upload
router.post('/', uploadController.uploadFile);

// GET field mapping form
router.get('/map', uploadController.getMapFields);

// POST field mapping
router.post('/map', uploadController.processMapping);

module.exports = router;
