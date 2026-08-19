const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { pool } = require('../db/pool');

async function isAdmin(adminId) {
    if (!adminId) return false;
    const r = await pool.query('SELECT role FROM users WHERE id = \$1', [parseInt(adminId)]);
    return r.rows.length > 0 && r.rows[0].role === 'admin';
}

function validerMotDePasse(password) {
    if (!password || password.length < 8)  return 'Minimum 8 caractères.';
    if (!/[A-Z]/.test(password))           return 'Au moins une majuscule requise.';
    if (!/[a-z]/.test(password))           return 'Au moins une minuscule requise.';
    if (!/[0-9]/.test(password))           return 'Au moins un chiffre requis.';
    if (!/[^A-Za-z0-9]/.test(password))    return 'Au moins un caractère spécial requis.';
    return null;
}

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });

        // Stats utilisateurs
        const totalUsers     = await pool.query('SELECT COUNT(*) FROM users');
        const totalAdmins    = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        const profilsRemplis = await pool.query("SELECT COUNT(*) FROM profiles WHERE prenom IS NOT NULL AND prenom != ''");
        const sansProfile    = await pool.query('SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE p.id IS NULL');

        // Connexions actives (connectés dans les 7 derniers jours)
        const actifsRecents  = await pool.query("SELECT COUNT(*) FROM users WHERE last_login >= NOW() - INTERVAL '7 days'");

        // Jamais connectés
        const jamaisConnectes = await pool.query("SELECT COUNT(*) FROM users WHERE last_login IS NULL");

        // Stats agrégées des données (sans données personnelles)
        const totalTaches      = await pool.query('SELECT COUNT(*) FROM taches');
        const tachesFaites     = await pool.query("SELECT COUNT(*) FROM taches WHERE faite = TRUE");
        const totalRdv         = await pool.query('SELECT COUNT(*) FROM rendezvous');
        const totalAnniversaires = await pool.query('SELECT COUNT(*) FROM anniversaires');
        const totalCycles      = await pool.query('SELECT COUNT(*) FROM cycle_journal');

        // Dernières connexions réelles (via last_login)
        const lastLogins = await pool.query(`
            SELECT u.id, u.username, u.role, u.last_login AS "lastLogin"
            FROM users u
            ORDER BY u.last_login DESC NULLS LAST
            LIMIT 5
        `);

        // Connexions par jour sur les 7 derniers jours
        const activiteJours = await pool.query(`
            SELECT DATE(last_login) AS jour, COUNT(*) AS nb
            FROM users
            WHERE last_login >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(last_login)
            ORDER BY jour ASC
        `);

        res.json({
            success          : true,
            totalUsers       : parseInt(totalUsers.rows[0].count),
            totalAdmins      : parseInt(totalAdmins.rows[0].count),
            profilsRemplis   : parseInt(profilsRemplis.rows[0].count),
            sansProfile      : parseInt(sansProfile.rows[0].count),
            actifsRecents    : parseInt(actifsRecents.rows[0].count),
            jamaisConnectes  : parseInt(jamaisConnectes.rows[0].count),
            totalTaches      : parseInt(totalTaches.rows[0].count),
            tachesFaites     : parseInt(tachesFaites.rows[0].count),
            totalRdv         : parseInt(totalRdv.rows[0].count),
            totalAnniversaires: parseInt(totalAnniversaires.rows[0].count),
            totalCycles      : parseInt(totalCycles.rows[0].count),
            lastLogins       : lastLogins.rows,
            activiteJours    : activiteJours.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const result = await pool.query(`
            SELECT u.id, u.username, u.role, u.last_login AS "lastLogin"
            FROM users u
            ORDER BY u.id
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET /api/admin/users/:id/profil
router.get('/users/:id/profil', async (req, res) => {
    const { adminId } = req.query;
    const targetId = parseInt(req.params.id);
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const user   = await pool.query('SELECT id, username, role FROM users WHERE id = \$1', [targetId]);
        const profil = await pool.query('SELECT * FROM profiles WHERE user_id = \$1', [targetId]);
        if (user.rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        res.json({ success: true, user: user.rows[0], profil: profil.rows[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/admin/users/:id/profil
router.patch('/users/:id/profil', async (req, res) => {
    const { adminId, username, prenom, nom, date_naissance, email, telephone, profession, note } = req.body;
    const targetId = parseInt(req.params.id);
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (username) {
            const exists = await pool.query('SELECT id FROM users WHERE username = \$1 AND id != \$2', [username, targetId]);
            if (exists.rows.length > 0) return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris" });
            await pool.query('UPDATE users SET username = \$1 WHERE id = \$2', [username, targetId]);
        }
        await pool.query(`
            INSERT INTO profiles (user_id, prenom, nom, date_naissance, email, telephone, profession, note, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                prenom=\$2, nom=\$3, date_naissance=\$4, email=\$5,
                telephone=\$6, profession=\$7, note=\$8, updated_at=NOW()
        `, [targetId, prenom||null, nom||null, date_naissance||null, email||null, telephone||null, profession||null, note||null]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
    const { adminId, username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Champs manquants' });
    const erreurMdp = validerMotDePasse(password);
    if (erreurMdp) return res.status(400).json({ success: false, message: erreurMdp });
    if (!['admin','user'].includes(role)) return res.status(400).json({ success: false, message: 'Rôle invalide' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const exists = await pool.query('SELECT id FROM users WHERE username = \$1', [username]);
        if (exists.rows.length) return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris" });
        const hash = await bcrypt.hash(password, 10);
        const r    = await pool.query(
            'INSERT INTO users (username, password, role) VALUES (\$1, \$2, \$3) RETURNING id',
            [username, hash, role]
        );
        res.json({ success: true, userId: r.rows[0].id });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
    const { adminId, role } = req.body;
    const targetId = parseInt(req.params.id);
    if (!['admin','user'].includes(role)) return res.status(400).json({ success: false, message: 'Rôle invalide' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        await pool.query('UPDATE users SET role = \$1 WHERE id = \$2', [role, targetId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PATCH /api/admin/users/:id/password
router.patch('/users/:id/password', async (req, res) => {
    const { adminId, password } = req.body;
    const targetId = parseInt(req.params.id);
    const erreurMdp = validerMotDePasse(password);
    if (erreurMdp) return res.status(400).json({ success: false, message: erreurMdp });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = \$1 WHERE id = \$2', [hash, targetId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    const { adminId } = req.body;
    const targetId = parseInt(req.params.id);
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (parseInt(adminId) === targetId) return res.status(400).json({ success: false, message: 'Impossible de se supprimer soi-même' });
        await pool.query('DELETE FROM users WHERE id = \$1', [targetId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
