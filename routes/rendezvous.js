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

// GET — tous les RDV de l'utilisatrice
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM rendezvous WHERE user_id = \$1 ORDER BY date_rdv ASC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST — ajouter un RDV
router.post('/', authMiddleware, async (req, res) => {
    const { titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO rendezvous (user_id, titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant)
             VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8) RETURNING *`,
            [req.user.id, titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant || 0]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT — modifier un RDV
router.put('/:id', authMiddleware, async (req, res) => {
    const { titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant } = req.body;
    try {
        const result = await pool.query(
            `UPDATE rendezvous SET titre=\$1, date_rdv=\$2, praticien=\$3, lieu=\$4,
             type_rdv=\$5, notes=\$6, rappel_avant=\$7
             WHERE id=\$8 AND user_id=\$9 RETURNING *`,
            [titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant || 0, req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE — supprimer un RDV
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM rendezvous WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: 'Accès refusé' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
