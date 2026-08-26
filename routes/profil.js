// routes/profil.js

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
            `SELECT prenom, nom, date_naissance, heure_naissance, lieu_naissance,
                    naissance_lat, naissance_lon,
                    email, telephone, profession, note, photo, widgets_visibles,
                    signe_zodiaque, sexe, taille, poids, groupe_sanguin,
                    niveau_activite, objectif_sante,
                    meteo_lat, meteo_lon, meteo_ville
             FROM profiles WHERE user_id = \$1`,
            [req.user.userId]
        );
        if (result.rows.length === 0) return res.json({ success: true, profil: null });
        res.json({ success: true, profil: result.rows[0] });
    } catch (err) {
        console.error('[PROFIL] GET /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/profil ──────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    const {
        prenom, nom, date_naissance, heure_naissance, lieu_naissance,
        naissance_lat, naissance_lon,
        email, telephone, profession, note, photo,
        signe_zodiaque, sexe, taille, poids, groupe_sanguin,
        niveau_activite, objectif_sante
    } = req.body;

    try {
        await pool.query(
            `INSERT INTO profiles (user_id, updated_at) VALUES (\$1, NOW()) ON CONFLICT (user_id) DO NOTHING`,
            [req.user.userId]
        );

        await pool.query(`
            UPDATE profiles SET
                prenom          = CASE WHEN \$2::text   IS NOT NULL THEN \$2::text    ELSE prenom          END,
                nom             = CASE WHEN \$3::text   IS NOT NULL THEN \$3::text    ELSE nom             END,
                date_naissance  = CASE WHEN \$4::text   IS NOT NULL THEN \$4::date    ELSE date_naissance  END,
                heure_naissance = CASE WHEN \$5::text   IS NOT NULL THEN \$5::time    ELSE heure_naissance END,
                lieu_naissance  = CASE WHEN \$6::text   IS NOT NULL THEN \$6::text    ELSE lieu_naissance  END,
                naissance_lat   = CASE WHEN \$7::text   IS NOT NULL THEN \$7::numeric ELSE naissance_lat   END,
                naissance_lon   = CASE WHEN \$8::text   IS NOT NULL THEN \$8::numeric ELSE naissance_lon   END,
                email           = CASE WHEN \$9::text   IS NOT NULL THEN \$9::text    ELSE email           END,
                telephone       = CASE WHEN \$10::text  IS NOT NULL THEN \$10::text   ELSE telephone       END,
                profession      = CASE WHEN \$11::text  IS NOT NULL THEN \$11::text   ELSE profession      END,
                note            = CASE WHEN \$12::text  IS NOT NULL THEN \$12::text   ELSE note            END,
                photo           = CASE WHEN \$13::text  IS NOT NULL THEN \$13::text   ELSE photo           END,
                signe_zodiaque  = CASE WHEN \$14::text  IS NOT NULL THEN \$14::text   ELSE signe_zodiaque  END,
                sexe            = CASE WHEN \$15::text  IS NOT NULL THEN \$15::text   ELSE sexe            END,
                taille          = CASE WHEN \$16::text  IS NOT NULL THEN \$16::integer ELSE taille         END,
                poids           = CASE WHEN \$17::text  IS NOT NULL THEN \$17::numeric ELSE poids          END,
                groupe_sanguin  = CASE WHEN \$18::text  IS NOT NULL THEN \$18::text   ELSE groupe_sanguin  END,
                niveau_activite = CASE WHEN \$19::text  IS NOT NULL THEN \$19::text   ELSE niveau_activite END,
                objectif_sante  = CASE WHEN \$20::text  IS NOT NULL THEN \$20::text   ELSE objectif_sante  END,
                updated_at      = NOW()
            WHERE user_id = \$1
        `, [
            req.user.userId,
            prenom          != null && prenom          !== '' ? prenom          : null,
            nom             != null && nom             !== '' ? nom             : null,
            date_naissance  != null && date_naissance  !== '' ? date_naissance  : null,
            heure_naissance != null && heure_naissance !== '' ? heure_naissance : null,
            lieu_naissance  != null && lieu_naissance  !== '' ? lieu_naissance  : null,
            naissance_lat   != null                           ? String(naissance_lat) : null,
            naissance_lon   != null                           ? String(naissance_lon) : null,
            email           != null && email           !== '' ? email           : null,
            telephone       != null && telephone       !== '' ? telephone       : null,
            profession      != null && profession      !== '' ? profession      : null,
            note            != null && note            !== '' ? note            : null,
            photo           != null && photo           !== '' ? photo           : null,
            signe_zodiaque  != null && signe_zodiaque  !== '' ? signe_zodiaque  : null,
            sexe            != null && sexe            !== '' ? sexe            : null,
            taille          != null                           ? String(taille)  : null,
            poids           != null                           ? String(poids)   : null,
            groupe_sanguin  != null && groupe_sanguin  !== '' ? groupe_sanguin  : null,
            niveau_activite != null && niveau_activite !== '' ? niveau_activite : null,
            objectif_sante  != null && objectif_sante  !== '' ? objectif_sante  : null,
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] POST /', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/profil/meteo-ville ─────────────────────────────
router.patch('/meteo-ville', authenticateToken, async (req, res) => {
    const { lat, lon, ville } = req.body;
    if (!lat || !lon) return res.status(400).json({ success: false, message: 'Coordonnées manquantes.' });
    try {
        await pool.query(
            `UPDATE profiles SET meteo_lat = \$1, meteo_lon = \$2, meteo_ville = \$3, updated_at = NOW() WHERE user_id = \$4`,
            [lat, lon, ville || null, req.user.userId]
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
            [req.user.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] DELETE /photo :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/profil/changer-mdp ─────────────────────────────
router.post('/changer-mdp', authenticateToken, async (req, res) => {
    const { ancienMdp, nouveauMdp } = req.body;
    if (!ancienMdp || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants.' });
    const erreur = validerMotDePasse(nouveauMdp);
    if (erreur) return res.status(400).json({ success: false, message: erreur });
    try {
        const result = await pool.query(
            'SELECT password FROM users WHERE id = \$1',
            [req.user.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const match = await bcrypt.compare(ancienMdp, result.rows[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect.' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query(
            'UPDATE users SET password = \$1, must_change_password = FALSE WHERE id = \$2',
            [hash, req.user.userId]
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
            [req.user.userId]
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
    if (!Array.isArray(widgets_caches)) return res.status(400).json({ success: false, message: 'Format invalide.' });
    try {
        await pool.query(
            'UPDATE profiles SET widgets_visibles = \$1, updated_at = NOW() WHERE user_id = \$2',
            [widgets_caches, req.user.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROFIL] PATCH /widgets-visibles :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/profil/abonnes/:userId ──────────────────────────
router.get('/abonnes/:userId', authenticateToken, async (req, res) => {
    const cibleId = parseInt(req.params.userId);
    if (isNaN(cibleId)) return res.status(400).json({ success: false, message: 'ID invalide.' });
    if (cibleId !== req.user.userId) return res.status(403).json({ success: false, message: 'Accès refusé.' });
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, p.prenom, p.nom, p.photo
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            LEFT JOIN profiles p ON p.user_id = f.follower_id
            WHERE f.following_id = \$1
            ORDER BY u.username ASC
        `, [cibleId]);
        res.json({ success: true, abonnes: rows });
    } catch (err) {
        console.error('[PROFIL] GET /abonnes/:userId :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/profil/public/:userId ───────────────────────────
router.get('/public/:userId', authenticateToken, async (req, res) => {
    const cibleId = parseInt(req.params.userId);
    const moi     = req.user.userId;
    if (isNaN(cibleId)) return res.status(400).json({ success: false, message: 'ID invalide.' });
    try {
        const profilRes = await pool.query(
            `SELECT u.id, u.username, p.prenom, p.nom, p.photo,
                    p.signe_zodiaque, p.note
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = \$1`,
            [cibleId]
        );
        if (profilRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const profil = profilRes.rows[0];

        const [[postsRes], [abonnesRes], [abonnementsRes], [suiviRes]] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM posts WHERE user_id = \$1',                                [cibleId]),
            pool.query('SELECT COUNT(*) FROM follows WHERE following_id = \$1',                         [cibleId]),
            pool.query('SELECT COUNT(*) FROM follows WHERE follower_id = \$1',                          [cibleId]),
            pool.query('SELECT 1 FROM follows WHERE follower_id = \$1 AND following_id = \$2', [moi, cibleId])
        ].map(p => p.then(r => [r])));

        res.json({
            success: true,
            profil: {
                id             : profil.id,
                username       : profil.username,
                prenom         : profil.prenom || '',
                nom            : profil.nom    || '',
                photo          : profil.photo  || null,
                signe_zodiaque : profil.signe_zodiaque || null,
                note           : profil.note   || null,
                nb_posts       : parseInt(postsRes.rows[0].count),
                nb_abonnes     : parseInt(abonnesRes.rows[0].count),
                nb_abonnements : parseInt(abonnementsRes.rows[0].count),
                suivi          : suiviRes.rows.length > 0
            }
        });
    } catch (err) {
        console.error('[PROFIL] GET /public/:userId :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
