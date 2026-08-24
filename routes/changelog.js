// ============================================================
// routes/changelog.js
// Lecture du fichier CHANGELOG.md et renvoi au client
// ============================================================

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

// GET /api/changelog
router.get('/changelog', (req, res) => {
    const filePath = path.join(__dirname, '..', 'CHANGELOG.md');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ success: false, message: 'Changelog indisponible.' });
        }
        res.json({ success: true, contenu: data });
    });
});

module.exports = router;
