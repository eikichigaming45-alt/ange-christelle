// ============================================================
// routes/rendezvous.js — v3.46
// CRUD des rendez-vous médicaux utilisateur.
// Purge lazy : suppression silencieuse des RDV > 12 mois au GET.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── GET /api/rendezvous ───────────────────────────────────────
// Purge lazy RDV > 12 mois, puis retourne tous les RDV triés.
router.get('/', async (req, res) => {
    try {
        // Purge silencieuse — RDV passés de plus de 12 mois
        await pool.query(
            `DELETE FROM rendezvous
             WHERE user_id = \$1
               AND date_rdv < NOW() - INTERVAL '12 months'`,
            [req.user.id]
        );

        const result = await pool.query(
            `SELECT id, titre, date_rdv, praticien, lieu, type_rdv,
                    notes, rappel_avant, created_at
             FROM rendezvous
             WHERE user_id = \$1
             ORDER BY date_rdv ASC`,
            [req.user.id]
        );
        res.json({ success: true, rendezvous: result.rows });
    } catch (err) {
        console.error('[RDV] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/rendezvous ──────────────────────────────────────
// Crée un nouveau rendez-vous.
router.post('/', async (req, res) => {
    const { titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant } = req.body;
    if (!titre || !date_rdv) {
        return res.status(400).json({ success: false, message: 'Titre et date sont obligatoires.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO rendezvous
                (user_id, titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant)
             VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8)
             RETURNING *`,
            [req.user.id, titre, date_rdv,
             praticien || null, lieu || null,
             type_rdv  || null, notes || null,
             rappel_avant || 0]
        );
        res.json({ success: true, rendezvous: result.rows[0] });
    } catch (err) {
        console.error('[RDV] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/rendezvous/:id ───────────────────────────────────
// Met à jour un rendez-vous (vérification propriétaire).
router.put('/:id', async (req, res) => {
    const { titre, date_rdv, praticien, lieu, type_rdv, notes, rappel_avant } = req.body;
    if (!titre || !date_rdv) {
        return res.status(400).json({ success: false, message: 'Titre et date sont obligatoires.' });
    }
    try {
        const result = await pool.query(
            `UPDATE rendezvous
             SET titre=\$1, date_rdv=\$2, praticien=\$3, lieu=\$4,
                 type_rdv=\$5, notes=\$6, rappel_avant=\$7
             WHERE id=\$8 AND user_id=\$9
             RETURNING *`,
            [titre, date_rdv,
             praticien || null, lieu || null,
             type_rdv  || null, notes || null,
             rappel_avant || 0,
             req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }
        res.json({ success: true, rendezvous: result.rows[0] });
    } catch (err) {
        console.error('[RDV] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/rendezvous/:id ────────────────────────────────
// Supprime un rendez-vous (vérification propriétaire).
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM rendezvous WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Rendez-vous introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[RDV] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
