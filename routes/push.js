const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

router.post('/subscribe', async (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ success: false });
    try {
        await pool.query(`
            INSERT INTO push_subscriptions (user_id, subscription, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE SET subscription=\$2, updated_at=NOW();
        `, [userId, JSON.stringify(subscription)]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
