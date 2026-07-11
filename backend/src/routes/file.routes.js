const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');

// Route publique : le token lui-même fait office d'authentification.
// Il est long (48 hex), à usage limité et expirant — voir file.controller.js.
router.get('/download/:token', fileController.downloadFile);

module.exports = router;
