const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { authenticateToken } = require('./auth');

// GET profil
router.get('/', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query('SELECT * FROM profiles WHERE user_id = \$1', [userId]);
        if (result.rows.length === 0) return res.json({ success: true, profil: null });
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST profil
router.post('/', async (req, res) => {
    const { userId, prenom, nom, date_naissance, email, telephone, profession, note, photo } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        await pool.query(`
            INSERT INTO profiles (user_id, prenom, nom, date_naissance, email, telephone, profession, note, photo, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                prenom=\$2, nom=\$3, date_naissance=\$4, email=\$5,
                telephone=\$6, profession=\$7, note=\$8, photo=\$9, updated_at=NOW();
        `, [userId, prenom, nom, date_naissance||null, email, telephone, profession, note, photo]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST changer mdp
router.post('/changer-mdp', async (req, res) => {
    const { userId, ancienMdp, nouveauMdp } = req.body;
    if (!userId || !ancienMdp || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (nouveauMdp.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = \$1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        const match = await bcrypt.compare(ancienMdp, result.rows[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query('UPDATE users SET password = \$1 WHERE id = \$2', [hash, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET widgets visibles
router.get('/widgets-visibles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT widgets_visibles FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const widgets = result.rows[0]?.widgets_visibles ||
            ['meteo','priere','planning','rendezvous','cycle','taches','anniversaires'];
        res.json({ widgets_visibles: widgets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH widgets visibles
router.patch('/widgets-visibles', authenticateToken, async (req, res) => {
    try {
        const { widgets_visibles } = req.body;
        await pool.query(
            `UPDATE profiles SET widgets_visibles = \$1 WHERE user_id = \$2`,
            [widgets_visibles, req.user.id]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
