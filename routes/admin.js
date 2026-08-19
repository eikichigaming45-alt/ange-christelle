// ============================================================
// routes/admin.js
// Gestion des utilisateurs et statistiques — réservé aux admins.
// Auth via JWT (middleware/auth.js) — plus d'adminId client.
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const { pool }   = require('../db/pool');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validerMotDePasse }               = require('../utils/validations');

// ── Toutes les routes admin nécessitent JWT + rôle admin ──────
router.use(authenticateToken, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
// Statistiques globales du tableau de bord admin.
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers, totalAdmins, profilsRemplis, sansProfile,
            actifsRecents, jamaisConnectes, totalTaches, tachesFaites,
            totalRdv, totalAnniversaires, totalCycles, lastLogins, activiteJours
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM users"),
            pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
            pool.query("SELECT COUNT(*) FROM profiles WHERE prenom IS NOT NULL AND prenom != ''"),
            pool.query("SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE p.id IS NULL"),
            pool.query("SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '7 days'"),
            pool.query("SELECT COUNT(*) FROM users WHERE last_login IS NULL"),
            pool.query("SELECT COUNT(*) FROM taches"),
            pool.query("SELECT COUNT(*) FROM taches WHERE faite = TRUE"),
            pool.query("SELECT COUNT(*) FROM rendezvous"),
            pool.query("SELECT COUNT(*) FROM anniversaires"),
            pool.query("SELECT COUNT(*) FROM cycle_journal"),
            pool.query(`
                SELECT u.id, u.username, u.role, u.last_login AS "lastLogin", p.prenom, p.nom
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                ORDER BY u.last_login DESC NULLS LAST
                LIMIT 5
            `),
            pool.query(`
                SELECT DATE(last_login) AS jour, COUNT(*) AS nb
                FROM users
                WHERE last_login >= NOW() - INTERVAL '7 days'
                GROUP BY DATE(last_login)
                ORDER BY jour ASC
            `)
        ]);

        res.json({
            success            : true,
            totalUsers         : parseInt(totalUsers.rows[0].count),
            totalAdmins        : parseInt(totalAdmins.rows[0].count),
            profilsRemplis     : parseInt(profilsRemplis.rows[0].count),
            sansProfile        : parseInt(sansProfile.rows[0].count),
            actifsRecents      : parseInt(actifsRecents.rows[0].count),
            jamaisConnectes    : parseInt(jamaisConnectes.rows[0].count),
            totalTaches        : parseInt(totalTaches.rows[0].count),
            tachesFaites       : parseInt(tachesFaites.rows[0].count),
            totalRdv           : parseInt(totalRdv.rows[0].count),
            totalAnniversaires : parseInt(totalAnniversaires.rows[0].count),
            totalCycles        : parseInt(totalCycles.rows[0].count),
            lastLogins         : lastLogins.rows,
            activiteJours      : activiteJours.rows
        });
    } catch (err) {
        console.error('[ADMIN] GET /stats :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/admin/users ──────────────────────────────────────
// Liste tous les utilisateurs avec leur profil.
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.role, u.last_login AS "lastLogin",
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
// Retourne le compte + profil d'un utilisateur spécifique.
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
// Met à jour le compte et le profil d'un utilisateur.
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
// Crée un nouvel utilisateur.
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
// Change le rôle d'un utilisateur.
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
// Réinitialise le mot de passe d'un utilisateur.
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
// Supprime un utilisateur (impossible de se supprimer soi-même).
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
