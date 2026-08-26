// ============================================================
// routes/admin.js
// Gestion des utilisateurs et statistiques — réservé aux admins.
// v1.30 — last_activity, top contributeurs, widgets populaires.
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const { pool }   = require('../db/pool');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validerMotDePasse }               = require('../utils/validations');

router.use(authenticateToken, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers, totalAdmins, profilsRemplis, sansProfile,
            actifsRecents, jamaisActifs, lastActivity,
            topContributeurs, widgetsPopulaires
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
            pool.query("SELECT COUNT(*) FROM profiles WHERE prenom IS NOT NULL AND prenom != ''"),
            pool.query("SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE p.id IS NULL"),
            pool.query("SELECT COUNT(*) FROM users WHERE last_activity >= NOW() - INTERVAL '7 days'"),
            pool.query("SELECT COUNT(*) FROM users WHERE last_activity IS NULL"),

            // Dernière activité — top 5
            pool.query(`
                SELECT u.id, u.username, u.role,
                       u.last_activity AS "lastActivity",
                       p.prenom, p.nom
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                ORDER BY u.last_activity DESC NULLS LAST
                LIMIT 5
            `),

            // Top 5 contributeurs — score pondéré
            pool.query(`
                SELECT
                    u.id, u.username, u.role,
                    p.prenom, p.nom,
                    COALESCE(po.nb, 0)  AS posts,
                    COALESCE(co.nb, 0)  AS commentaires,
                    COALESCE(pl.nb, 0)  AS likes,
                    COALESCE(rv.nb, 0)  AS rdv,
                    COALESCE(ta.nb, 0)  AS taches,
                    COALESCE(an.nb, 0)  AS anniversaires,
                    (
                        COALESCE(po.nb, 0) * 3 +
                        COALESCE(co.nb, 0) * 2 +
                        COALESCE(pl.nb, 0)     +
                        COALESCE(rv.nb, 0)     +
                        COALESCE(ta.nb, 0)     +
                        COALESCE(an.nb, 0)
                    ) AS score
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM posts        GROUP BY user_id) po ON po.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM post_comments GROUP BY user_id) co ON co.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM post_likes   GROUP BY user_id) pl ON pl.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM rendezvous   GROUP BY user_id) rv ON rv.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM taches        GROUP BY user_id) ta ON ta.user_id = u.id
                LEFT JOIN (SELECT user_id, COUNT(*) AS nb FROM anniversaires GROUP BY user_id) an ON an.user_id = u.id
                ORDER BY score DESC
                LIMIT 5
            `),

            // Widgets les plus utilisés — dépilage du tableau widgets_visibles
            pool.query(`
                SELECT widget, COUNT(*) AS nb
                FROM profiles, unnest(widgets_visibles) AS widget
                GROUP BY widget
                ORDER BY nb DESC
            `)
        ]);

        res.json({
            success           : true,
            totalUsers        : parseInt(totalUsers.rows[0].count),
            totalAdmins       : parseInt(totalAdmins.rows[0].count),
            profilsRemplis    : parseInt(profilsRemplis.rows[0].count),
            sansProfile       : parseInt(sansProfile.rows[0].count),
            actifsRecents     : parseInt(actifsRecents.rows[0].count),
            jamaisActifs      : parseInt(jamaisActifs.rows[0].count),
            lastActivity      : lastActivity.rows,
            topContributeurs  : topContributeurs.rows,
            widgetsPopulaires : widgetsPopulaires.rows
        });
    } catch (err) {
        console.error('[ADMIN] GET /stats :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.role,
                   u.last_activity AS "lastActivity",
                   p.prenom, p.nom
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY u.id
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error('[ADMIN] GET /users :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/admin/users/:id/profil ──────────────────────────
router.get('/users/:id/profil', async (req, res) => {
    const targetId = parseInt(req.params.id);
    try {
        const [user, profil] = await Promise.all([
            pool.query('SELECT id, username, role FROM users WHERE id = \$1', [targetId]),
            pool.query(
                `SELECT prenom, nom, date_naissance, email, telephone, profession, note
                 FROM profiles WHERE user_id = \$1`,
                [targetId]
            )
        ]);
        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.json({ success: true, user: user.rows[0], profil: profil.rows[0] || null });
    } catch (err) {
        console.error('[ADMIN] GET /users/:id/profil :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/admin/users/:id/profil ────────────────────────
router.patch('/users/:id/profil', async (req, res) => {
    const targetId = parseInt(req.params.id);
    const { username, prenom, nom, date_naissance, email, telephone, profession, note } = req.body;
    try {
        if (username) {
            const exists = await pool.query(
                'SELECT id FROM users WHERE username = \$1 AND id != \$2',
                [username, targetId]
            );
            if (exists.rows.length > 0) {
                return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris." });
            }
            await pool.query('UPDATE users SET username = \$1 WHERE id = \$2', [username, targetId]);
        }
        await pool.query(`
            INSERT INTO profiles
                (user_id, prenom, nom, date_naissance, email, telephone, profession, note, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                prenom=\$2, nom=\$3, date_naissance=\$4, email=\$5,
                telephone=\$6, profession=\$7, note=\$8, updated_at=NOW()
        `, [targetId, prenom||null, nom||null, date_naissance||null,
            email||null, telephone||null, profession||null, note||null]);
        res.json({ success: true });
    } catch (err) {
        console.error('[ADMIN] PATCH /users/:id/profil :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/admin/users ─────────────────────────────────────
router.post('/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Champs manquants.' });
    }
    const erreur = validerMotDePasse(password);
    if (erreur) return res.status(400).json({ success: false, message: erreur });
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide.' });
    }
    try {
        const exists = await pool.query('SELECT id FROM users WHERE username = \$1', [username]);
        if (exists.rows.length) {
            return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris." });
        }
        const hash   = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES (\$1, \$2, \$3) RETURNING id',
            [username, hash, role]
        );
        res.json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        console.error('[ADMIN] POST /users :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/admin/users/:id/role ──────────────────────────
router.patch('/users/:id/role', async (req, res) => {
    const targetId = parseInt(req.params.id);
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide.' });
    }
    try {
        await pool.query('UPDATE users SET role = \$1 WHERE id = \$2', [role, targetId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[ADMIN] PATCH /users/:id/role :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PATCH /api/admin/users/:id/password ──────────────────────
router.patch('/users/:id/password', async (req, res) => {
    const targetId = parseInt(req.params.id);
    const { password } = req.body;
    const erreur = validerMotDePasse(password);
    if (erreur) return res.status(400).json({ success: false, message: erreur });
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'UPDATE users SET password = \$1, must_change_password = FALSE WHERE id = \$2',
            [hash, targetId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[ADMIN] PATCH /users/:id/password :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/admin/users/:id ──────────────────────────────
router.delete('/users/:id', async (req, res) => {
    const targetId = parseInt(req.params.id);
    if (req.user.id === targetId) {
        return res.status(400).json({ success: false, message: 'Impossible de se supprimer soi-même.' });
    }
    try {
        await pool.query('DELETE FROM users WHERE id = \$1', [targetId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[ADMIN] DELETE /users/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
