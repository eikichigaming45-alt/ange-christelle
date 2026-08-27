// ============================================================
// routes/widgets.js
// Gestion de l'ordre des widgets et tracking des ouvertures.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/widget-order ─────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT ordre FROM widget_order WHERE user_id = \$1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.json({ success: true, ordre: null });
        }
        res.json({ success: true, ordre: JSON.parse(result.rows[0].ordre) });
    } catch (err) {
        console.error('[WIDGETS] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/widget-order ────────────────────────────────────
router.post('/', async (req, res) => {
    const { ordre } = req.body;
    if (!ordre || !Array.isArray(ordre)) {
        return res.status(400).json({ success: false, message: 'Données manquantes.' });
    }
    try {
        await pool.query(`
            INSERT INTO widget_order (user_id, ordre, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ordre = \$2, updated_at = NOW()
        `, [req.user.id, JSON.stringify(ordre)]);
        res.json({ success: true });
    } catch (err) {
        console.error('[WIDGETS] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/widget-order/open ───────────────────────────────
router.post('/open', async (req, res) => {
    const { widget } = req.body;
    if (!widget) return res.status(400).json({ success: false });
    try {
        await pool.query(
            'INSERT INTO widget_opens (user_id, widget) VALUES (\$1, \$2)',
            [req.user.id, widget]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[WIDGETS] POST /open :', err.message);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
