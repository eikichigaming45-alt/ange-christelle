// ============================================================
// routes/profil.js
// Gestion du profil utilisateur : lecture, écriture, mot de passe,
// suppression photo, préférences widgets, profil public.
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const { pool }   = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { validerMotDePasse } = require('../utils/validations');

// ── GET /api/profil ───────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT prenom, nom, date_naissance, email, telephone,
                    profession, note, photo, widgets_visibles,
                    signe_zodiaque, sexe, meteo_lat, meteo_lon, meteo_ville
             FROM profiles WHERE user_id = \$1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.json({ success: true, profil: null });
        }
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
        console.error('[PROFIL] GET /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/profil/public/:id ────────────────────────────────
router.get('/public/:id', authenticateToken, async (req, res) => {
    const cibleId  = parseInt(req.params.id);
    const userId   = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT
                u.id, u.username,
                pr.prenom, pr.nom, pr.photo, pr.signe_zodiaque,
                (SELECT COUNT(*) FROM posts       WHERE user_id = u.id)::int AS nb_posts,
                (SELECT COUNT(*) FROM follows     WHERE following_id = u.id)::int AS nb_abonnes,
                (SELECT COUNT(*) FROM follows     WHERE follower_id  = u.id)::int AS nb_abonnements,
                EXISTS(SELECT 1 FROM follows WHERE follower_id = \$2 AND following_id = u.id) AS suivi
            FROM users u
            LEFT JOIN profiles pr ON pr.user_id = u.id
            WHERE u.id = \$1
        `, [cibleId, userId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        res.json({ success: true, profil: rows[0] });
    } catch (err) {
        console.error('[PROFIL] GET /public/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/profil ──────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    const { prenom, nom, date_naissance, email, telephone,
            profession, note, photo, signe_zodiaque, sexe } = req.body;
    try {
        await pool.query(`
            INSERT INTO profiles
                (user_id, prenom, nom, date_naissance, email, telephone,
                 profession, note, photo, signe_zodiaque, sexe, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                prenom=\$2, nom=\$3, date_naissance=\$4, email=\$5,
                telephone=\$6, profession=\$7, note=\$8, photo=\$9,
                signe_zodiaque=\$10, sexe=\$11, updated_at=NOW()
        `, [req.user.id, prenom, nom, date_naissance || null,
            email, telephone, profession, note, photo,
            signe_zodiaque || null, sexe || null]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] POST /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/profil/meteo-ville ────────────────────────────
router.patch('/meteo-ville', authenticateToken, async (req, res) => {
    const { lat, lon, ville } = req.body;
    if (!lat || !lon) {
        return res.status(400).json({ success: false, message: 'Coordonnées manquantes.' });
    }
    try {
        await pool.query(
            `UPDATE profiles
             SET meteo_lat = \$1, meteo_lon = \$2, meteo_ville = \$3, updated_at = NOW()
             WHERE user_id = \$4`,
            [lat, lon, ville || null, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] PATCH /meteo-ville :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/profil/photo ──────────────────────────────────
router.delete('/photo', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE profiles SET photo = NULL, updated_at = NOW() WHERE user_id = \$1',
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] DELETE /photo :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/profil/changer-mdp ──────────────────────────────
router.post('/changer-mdp', authenticateToken, async (req, res) => {
    const { ancienMdp, nouveauMdp } = req.body;
    if (!ancienMdp || !nouveauMdp) {
        return res.status(400).json({ success: false, message: 'Champs manquants.' });
    }
    const erreur = validerMotDePasse(nouveauMdp);
    if (erreur) return res.status(400).json({ success: false, message: erreur });
    try {
        const result = await pool.query(
            'SELECT password FROM users WHERE id = \$1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        const match = await bcrypt.compare(ancienMdp, result.rows[0].password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect.' });
        }
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query(
            'UPDATE users SET password = \$1, must_change_password = FALSE WHERE id = \$2',
            [hash, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] POST /changer-mdp :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/profil/widgets-visibles ─────────────────────────
router.get('/widgets-visibles', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT widgets_visibles FROM profiles WHERE user_id = \$1',
            [req.user.id]
        );
        const widgets_caches = result.rows[0]?.widgets_visibles || [];
        res.json({ success: true, widgets_caches });
    } catch (err) {
        console.error('[PROFIL] GET /widgets-visibles :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/profil/widgets-visibles ───────────────────────
router.patch('/widgets-visibles', authenticateToken, async (req, res) => {
    const { widgets_caches } = req.body;
    if (!Array.isArray(widgets_caches)) {
        return res.status(400).json({ success: false, message: 'Format invalide.' });
    }
    try {
        await pool.query(
            'UPDATE profiles SET widgets_visibles = \$1 WHERE user_id = \$2',
            [widgets_caches, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] PATCH /widgets-visibles :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
