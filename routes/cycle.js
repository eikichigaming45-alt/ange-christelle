const express = require('express');
const router = express.Router();
const pool = require('../db/pool').pool;
const jwt = require('jsonwebtoken');

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

// GET — tous les cycles
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM cycles WHERE user_id = \$1 ORDER BY date_debut DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST — ajouter un cycle
router.post('/', authMiddleware, async (req, res) => {
    const { date_debut, duree_regles, duree_cycle, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO cycles (user_id, date_debut, duree_regles, duree_cycle, notes)
             VALUES (\$1, \$2, \$3, \$4, \$5) RETURNING *`,
            [req.user.id, date_debut, duree_regles || 5, duree_cycle || 28, notes]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT — modifier un cycle
router.put('/:id', authMiddleware, async (req, res) => {
    const { date_debut, duree_regles, duree_cycle, notes } = req.body;
    try {
        const result = await pool.query(
            `UPDATE cycles SET date_debut=\$1, duree_regles=\$2, duree_cycle=\$3, notes=\$4
             WHERE id=\$5 AND user_id=\$6 RETURNING *`,
            [date_debut, duree_regles, duree_cycle, notes, req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE — supprimer un cycle
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cycles WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET — journal d'un mois
router.get('/journal', authMiddleware, async (req, res) => {
    const { mois, annee } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM cycle_journal 
             WHERE user_id = \$1 
             AND EXTRACT(MONTH FROM date) = \$2 
             AND EXTRACT(YEAR FROM date) = \$3`,
            [req.user.id, mois, annee]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST — sauvegarder une entrée journal
router.post('/journal', authMiddleware, async (req, res) => {
    const { date, rapport, symptomes, notes } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO cycle_journal (user_id, date, humeur, symptomes, notes)
             VALUES (\$1, \$2, \$3, \$4, \$5)
             ON CONFLICT (user_id, date) DO UPDATE 
             SET humeur=\$3, symptomes=\$4, notes=\$5
             RETURNING *`,
            [req.user.id, date, rapport || null, symptomes || null, notes || null]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE — supprimer une entrée journal
router.delete('/journal/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cycle_journal WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
