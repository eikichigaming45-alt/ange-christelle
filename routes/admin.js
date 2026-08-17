const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { pool } = require('../db/pool');

async function isAdmin(adminId) {
    if (!adminId) return false;
    const r = await pool.query('SELECT role FROM users WHERE id = \$1', [parseInt(adminId)]);
    return r.rows.length > 0 && r.rows[0].role === 'admin';
}

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const totalUsers     = await pool.query('SELECT COUNT(*) FROM users');
        const totalAdmins    = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        const profilsRemplis = await pool.query("SELECT COUNT(*) FROM profiles WHERE prenom IS NOT NULL AND prenom != ''");
        const sansProfile    = await pool.query('SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE p.id IS NULL');
        const lastLogins     = await pool.query(`
            SELECT u.username, u.role, p.updated_at AS "lastLogin"
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY p.updated_at DESC NULLS LAST LIMIT 5
        `);
        res.json({
            success       : true,
            totalUsers    : parseInt(totalUsers.rows[0].count),
            totalAdmins   : parseInt(totalAdmins.rows[0].count),
            profilsRemplis: parseInt(profilsRemplis.rows[0].count),
            sansProfile   : parseInt(sansProfile.rows[0].count),
            lastLogins    : lastLogins.rows
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
            SELECT u.id, u.username, u.role, p.updated_at AS "lastLogin"
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY u.id
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
    const { adminId, username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (password.length < 6)   return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
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
    if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
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
