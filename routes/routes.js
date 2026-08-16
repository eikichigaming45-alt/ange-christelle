const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const webpush = require('web-push');

webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Enregistrer un abonnement
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

// Envoyer une notification
router.post('/send', async (req, res) => {
    const { userId, titre, corps, url } = req.body;
    try {
        const result = await pool.query(
            'SELECT subscription FROM push_subscriptions WHERE user_id = \$1',
            [userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Aucun abonnement' });
        const subscription = JSON.parse(result.rows[0].subscription);
        await webpush.sendNotification(subscription, JSON.stringify({
            titre: titre || 'MyVibe',
            corps: corps || '',
            url: url || '/',
            tag: 'myvibe'
        }));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
