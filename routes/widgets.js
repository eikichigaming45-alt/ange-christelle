const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

router.get('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query('SELECT ordre FROM widget_order WHERE user_id = \$1', [userId]);
        if (result.rows.length === 0) return res.json({ success: true, ordre: null });
        res.json({ success: true, ordre: JSON.parse(result.rows[0].ordre) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    const { userId, ordre } = req.body;
    if (!userId || !ordre) return res.status(400).json({ success: false, message: 'Données manquantes' });
    try {
        await pool.query(`
            INSERT INTO widget_order (user_id, ordre, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET ordre=\$2, updated_at=NOW();
        `, [userId, JSON.stringify(ordre)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
