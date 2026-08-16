const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

router.get('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query(`
            SELECT * FROM anniversaires WHERE user_id=\$1
            ORDER BY mois ASC, jour ASC
        `, [userId]);
        res.json({ success: true, anniversaires: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    const { userId, prenom, nom, jour, mois, annee } = req.body;
    if (!userId || !prenom || !jour || !mois) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        const result = await pool.query(`
            INSERT INTO anniversaires (user_id, prenom, nom, jour, mois, annee)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6) RETURNING *
        `, [userId, prenom, nom||null, parseInt(jour), parseInt(mois), annee ? parseInt(annee) : null]);
        res.json({ success: true, anniversaire: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, prenom, nom, jour, mois, annee } = req.body;
    if (!userId || !prenom || !jour || !mois) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        await pool.query(
            'UPDATE anniversaires SET prenom=\$1, nom=\$2, jour=\$3, mois=\$4, annee=\$5 WHERE id=\$6 AND user_id=\$7',
            [prenom, nom||null, parseInt(jour), parseInt(mois), annee||null, id, userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId || req.body.userId;
    try {
        await pool.query('DELETE FROM anniversaires WHERE id=\$1 AND user_id=\$2', [id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
