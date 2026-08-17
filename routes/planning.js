const express = require('express');
const router  = express.Router();
const { pool } = require('../db/pool');
const jwt     = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ── EMPLOYEURS (table dédiée) ─────────────────────────────────────────────────
router.get('/employeurs', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nom FROM planning_employeurs WHERE user_id = \$1 ORDER BY nom ASC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/employeurs', authMiddleware, async (req, res) => {
  const { nom } = req.body;
  if (!nom?.trim()) return res.status(400).json({ error: 'Nom requis' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO planning_employeurs (user_id, nom) VALUES (\$1, \$2) ON CONFLICT (user_id, nom) DO NOTHING RETURNING *',
      [req.user.userId, nom.trim()]
    );
    res.json(rows[0] || { message: 'Déjà existant' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/employeurs/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM planning_employeurs WHERE id = \$1 AND user_id = \$2',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LISTE PAR MOIS ────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { mois, annee } = req.query;
  try {
    const result = await pool.query(`
      SELECT *, TO_CHAR(date, 'YYYY-MM-DD') as date_str FROM planning
      WHERE user_id = \$1
        AND EXTRACT(MONTH FROM date) = \$2
        AND EXTRACT(YEAR  FROM date) = \$3
      ORDER BY date ASC
    `, [req.user.userId, mois, annee]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PAR JOUR ──────────────────────────────────────────────────────────────────
router.get('/jour', authMiddleware, async (req, res) => {
  const { date } = req.query;
  try {
    const result = await pool.query(`
      SELECT *, TO_CHAR(date, 'YYYY-MM-DD') as date_str FROM planning
      WHERE user_id = \$1 AND date = \$2
      ORDER BY heure_debut ASC
    `, [req.user.userId, date]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PAR ID ────────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, TO_CHAR(date, 'YYYY-MM-DD') as date_str FROM planning
      WHERE id = \$1 AND user_id = \$2
    `, [req.params.id, req.user.userId]);
    if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
    res.json({ entry: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CRÉER ─────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO planning
        (user_id, date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant)
      VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10)
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date_str
    `, [req.user.userId, date, type,
        heure_debut  || null,
        heure_fin    || null,
        employeur    || null,
        adresse      || null,
        telephone    || null,
        notes        || null,
        rappel_avant || 120]);
    res.json({ success: true, planning: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── MODIFIER ──────────────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
  try {
    const result = await pool.query(`
      UPDATE planning
      SET date=\$1, type=\$2, heure_debut=\$3, heure_fin=\$4,
          employeur=\$5, adresse=\$6, telephone=\$7, notes=\$8, rappel_avant=\$9
      WHERE id=\$10 AND user_id=\$11
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date_str
    `, [date, type,
        heure_debut  || null,
        heure_fin    || null,
        employeur    || null,
        adresse      || null,
        telephone    || null,
        notes        || null,
        rappel_avant || 120,
        req.params.id, req.user.userId]);
    if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
    res.json({ success: true, planning: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SUPPRIMER ─────────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM planning WHERE id=\$1 AND user_id=\$2',
      [req.params.id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
