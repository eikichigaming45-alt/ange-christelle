const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = \$1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Utilisateur inconnu' });
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) res.json({ success: true, role: user.role, userId: user.id, username: user.username });
        else res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
