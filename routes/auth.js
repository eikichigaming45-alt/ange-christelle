const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

function validerMotDePasse(password) {
  if (!password || password.length < 8)  return false;
  if (!/[A-Z]/.test(password))           return false;
  if (!/[a-z]/.test(password))           return false;
  if (!/[0-9]/.test(password))           return false;
  if (!/[^A-Za-z0-9]/.test(password))    return false;
  return true;
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = \$1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Utilisateur inconnu' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      const mustChange = user.must_change_password || !validerMotDePasse(password);
      if (!validerMotDePasse(password) && !user.must_change_password) {
        await pool.query('UPDATE users SET must_change_password = TRUE WHERE id = \$1', [user.id]);
      }
      const token = jwt.sign(
        { userId: user.id, id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({
        success: true,
        role: user.role,
        userId: user.id,
        username: user.username,
        token,
        mustChangePassword: mustChange
      });
    } else {
      res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

module.exports = { router, authenticateToken };
