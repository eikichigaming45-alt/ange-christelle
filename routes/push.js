// ============================================================
// routes/push.js
// Gestion des abonnements aux notifications push (Web Push).
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── POST /api/push/subscribe ──────────────────────────────────
// Enregistre ou met à jour l'abonnement push de l'utilisateur.
// La subscription est stockée en JSON stringifié dans TEXT.
router.post('/subscribe', async (req, res) => {
    const { subscription } = req.body;
    if (!subscription) {
        return res.status(400).json({ success: false, message: 'Subscription manquante.' });
    }
    try {
        await pool.query(`
            INSERT INTO push_subscriptions (user_id, subscription, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET subscription = \$2, updated_at = NOW()
        `, [req.user.id, JSON.stringify(subscription)]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUSH] POST /subscribe :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
