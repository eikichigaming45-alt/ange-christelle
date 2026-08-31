// ============================================================
// routes/eclats.js
// Éclats — stories 24h : upload, lecture, expiration auto
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const multer                = require('multer');
const sharp                 = require('sharp');
const path                  = require('path');
const fs                    = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads/eclats');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /api/eclats ──────────────────────────────────────────
router.post('/', authenticateToken, upload.single('media'), async (req, res) => {
    const userId   = req.user.id;
    const photoB64 = req.body.media || null;

    if (!req.file && !photoB64) {
        return res.status(400).json({ success: false, message: 'Média requis.' });
    }
    try {
        const buffer   = req.file ? req.file.buffer : Buffer.from(photoB64, 'base64');
        const filename = `${userId}_${Date.now()}.webp`;
        const filepath = path.join(UPLOADS_DIR, filename);
        await sharp(buffer).webp({ quality: 80 }).toFile(filepath);
        const media_url  = `/uploads/eclats/${filename}`;
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const { rows } = await pool.query(
            `INSERT INTO eclats (user_id, media_url, expires_at)
             VALUES (\$1, \$2, \$3)
             RETURNING id, media_url, created_at, expires_at`,
            [userId, media_url, expires_at]
        );
        res.json({ success: true, eclat: rows[0] });
    } catch (e) {
        console.error('[ECLATS] POST /', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/eclats ───────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT e.id, e.user_id, e.media_url, e.created_at, e.expires_at,
                   p.prenom, p.nom, p.photo AS avatar,
                   u.username
            FROM eclats e
            JOIN users u ON u.id = e.user_id
            LEFT JOIN profiles p ON p.user_id = e.user_id
            WHERE e.expires_at > NOW()
            ORDER BY e.created_at DESC
        `);
        res.json({ success: true, eclats: rows });
    } catch (e) {
        console.error('[ECLATS] GET /', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/eclats/mes ───────────────────────────────────────
router.get('/mes', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, media_url, created_at, expires_at
            FROM eclats
            WHERE user_id = \$1 AND expires_at > NOW()
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json({ success: true, eclats: rows });
    } catch (e) {
        console.error('[ECLATS] GET /mes', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/eclats/:id ────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    const userId  = req.user.id;
    const eclatId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT user_id, media_url FROM eclats WHERE id = \$1`, [eclatId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Éclat introuvable.' });
        }
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        const filepath = path.join(__dirname, '../public', rows[0].media_url);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        await pool.query(`DELETE FROM eclats WHERE id = \$1`, [eclatId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[ECLATS] DELETE /:id', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
