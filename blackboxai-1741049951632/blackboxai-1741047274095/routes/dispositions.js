const express = require('express');
const router = express.Router();
const dispositionController = require('../controllers/dispositionController');

// GET dispositions page
router.get('/', dispositionController.getDispositionsPage);

// POST upload dispositions
router.post('/upload', dispositionController.uploadDispositions);

// POST add single disposition
router.post('/add', dispositionController.addDisposition);

// GET disposition by phone
router.get('/:phone', dispositionController.getDispositionByPhone);

// DELETE disposition
router.delete('/:phone', dispositionController.deleteDisposition);

module.exports = router;
