const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
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

// GET — planning du mois
router.get('/', authMiddleware, async (req, res) => {
    const { mois, annee } = req.query;
    try {
        const result = await pool.query(`
            SELECT *, TO_CHAR(date, 'YYYY-MM-DD') as date FROM planning
            WHERE user_id = \$1
            AND EXTRACT(MONTH FROM date) = \$2
            AND EXTRACT(YEAR FROM date) = \$3
            ORDER BY date ASC
        `, [req.user.id, mois, annee]);
        res.json({ success: true, planning: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET — jour spécifique
router.get('/jour', authMiddleware, async (req, res) => {
    const { date } = req.query;
    try {
        const result = await pool.query(`
            SELECT * FROM planning
            WHERE user_id = \$1 AND date = \$2
            ORDER BY heure_debut ASC
        `, [req.user.id, date]);
        res.json({ success: true, planning: result.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST — ajouter une entrée
router.post('/', authMiddleware, async (req, res) => {
    const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO planning (user_id, date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant)
            VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10) RETURNING *
        `, [req.user.id, date, type, heure_debut||null, heure_fin||null,
            employeur||'EPSM Georges Daumezon', adresse||null, telephone||null, notes||null, rappel_avant||120]);
        res.json({ success: true, planning: result.rows[0] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT — modifier une entrée
router.put('/:id', authMiddleware, async (req, res) => {
    const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
    try {
        const result = await pool.query(`
            UPDATE planning SET date=\$1, type=\$2, heure_debut=\$3, heure_fin=\$4,
            employeur=\$5, adresse=\$6, telephone=\$7, notes=\$8, rappel_avant=\$9
            WHERE id=\$10 AND user_id=\$11 RETURNING *
        `, [date, type, heure_debut||null, heure_fin||null,
            employeur||'EPSM Georges Daumezon', adresse||null, telephone||null, notes||null,
            rappel_avant||120, req.params.id, req.user.id]);
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json({ success: true, planning: result.rows[0] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE — supprimer une entrée
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM planning WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
