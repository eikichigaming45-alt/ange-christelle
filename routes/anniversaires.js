// ============================================================
// routes/anniversaires.js
// CRUD des anniversaires utilisateur.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── GET /api/anniversaires ────────────────────────────────────
// Retourne tous les anniversaires de l'utilisateur, triés par mois/jour.
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, prenom, nom, jour, mois, annee, created_at
            FROM anniversaires
            WHERE user_id = \$1
            ORDER BY mois ASC, jour ASC
        `, [req.user.id]);
        res.json({ success: true, anniversaires: result.rows });
    } catch (err) {
        console.error('[ANNIVERSAIRES] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/anniversaires ───────────────────────────────────
// Crée un nouvel anniversaire.
router.post('/', async (req, res) => {
    const { prenom, nom, jour, mois, annee } = req.body;
    if (!prenom || !jour || !mois) {
        return res.status(400).json({ success: false, message: 'Prénom, jour et mois sont obligatoires.' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO anniversaires (user_id, prenom, nom, jour, mois, annee)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6) RETURNING *
        `, [req.user.id, prenom, nom || null,
            parseInt(jour), parseInt(mois),
            annee ? parseInt(annee) : null]);
        res.json({ success: true, anniversaire: result.rows[0] });
    } catch (err) {
        console.error('[ANNIVERSAIRES] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/anniversaires/:id ────────────────────────────────
// Met à jour un anniversaire (vérification propriétaire).
router.put('/:id', async (req, res) => {
    const { prenom, nom, jour, mois, annee } = req.body;
    if (!prenom || !jour || !mois) {
        return res.status(400).json({ success: false, message: 'Prénom, jour et mois sont obligatoires.' });
    }
    try {
        const result = await pool.query(`
            UPDATE anniversaires
            SET prenom=\$1, nom=\$2, jour=\$3, mois=\$4, annee=\$5
            WHERE id=\$6 AND user_id=\$7
            RETURNING *
        `, [prenom, nom || null,
            parseInt(jour), parseInt(mois),
            annee ? parseInt(annee) : null,
            req.params.id, req.user.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Anniversaire introuvable.' });
        }
        res.json({ success: true, anniversaire: result.rows[0] });
    } catch (err) {
        console.error('[ANNIVERSAIRES] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/anniversaires/:id ─────────────────────────────
// Supprime un anniversaire (vérification propriétaire).
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM anniversaires WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Anniversaire introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[ANNIVERSAIRES] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
