const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

async function isAdmin(adminId) {
    const check = await pool.query('SELECT role FROM users WHERE id = \$1', [adminId]);
    return check.rows.length > 0 && check.rows[0].role === 'admin';
}

router.get('/users', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const result = await pool.query(`
            SELECT u.id, u.username, u.role, p.prenom, p.nom, p.email, p.profession, p.created_at
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id ORDER BY u.id
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/create-user', async (req, res) => {
    const { adminId, username, password, role } = req.body;
    if (!adminId || !username || !password || !role) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    if (!['admin','user'].includes(role)) return res.status(400).json({ success: false, message: 'Rôle invalide' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const exists = await pool.query('SELECT id FROM users WHERE username=\$1', [username]);
        if (exists.rows.length > 0) return res.status(409).json({ success: false, message: "Nom d'utilisateur déjà pris" });
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (username, password, role) VALUES (\$1,\$2,\$3) RETURNING id', [username, hash, role]);
        res.json({ success: true, userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/update-user', async (req, res) => {
    const { adminId, targetUserId, username, role } = req.body;
    if (!adminId || !targetUserId) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (username) {
            const exists = await pool.query('SELECT id FROM users WHERE username=\$1 AND id!=\$2', [username, targetUserId]);
            if (exists.rows.length > 0) return res.status(409).json({ success: false, message: "Nom déjà pris" });
            await pool.query('UPDATE users SET username=\$1 WHERE id=\$2', [username, targetUserId]);
        }
        if (role && ['admin','user'].includes(role)) {
            await pool.query('UPDATE users SET role=\$1 WHERE id=\$2', [role, targetUserId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/delete-user', async (req, res) => {
    const { adminId, targetUserId } = req.body;
    if (!adminId || !targetUserId) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        if (parseInt(adminId) === parseInt(targetUserId)) return res.status(400).json({ success: false, message: 'Impossible de se supprimer soi-même' });
        await pool.query('DELETE FROM users WHERE id=\$1', [targetUserId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/reset-mdp', async (req, res) => {
    const { adminId, targetUserId, nouveauMdp } = req.body;
    if (!adminId || !targetUserId || !nouveauMdp) return res.status(400).json({ success: false, message: 'Champs manquants' });
    if (nouveauMdp.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const hash = await bcrypt.hash(nouveauMdp, 10);
        await pool.query('UPDATE users SET password=\$1 WHERE id=\$2', [hash, targetUserId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.get('/stats', async (req, res) => {
    const { adminId } = req.query;
    try {
        if (!await isAdmin(adminId)) return res.status(403).json({ success: false, message: 'Accès refusé' });
        const totalUsers    = await pool.query('SELECT COUNT(*) FROM users');
        const totalAdmins   = await pool.query("SELECT COUNT(*) FROM users WHERE role='admin'");
        const totalProfiles = await pool.query('SELECT COUNT(*) FROM profiles');
        const lastLogins    = await pool.query(`
            SELECT u.username, u.role, p.updated_at
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY p.updated_at DESC NULLS LAST LIMIT 5
        `);
        res.json({ success: true, stats: {
            totalUsers:    parseInt(totalUsers.rows[0].count),
            totalAdmins:   parseInt(totalAdmins.rows[0].count),
            totalProfiles: parseInt(totalProfiles.rows[0].count),
            lastActivity:  lastLogins.rows
        }});
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
