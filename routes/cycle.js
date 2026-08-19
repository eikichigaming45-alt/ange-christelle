// ============================================================
// routes/cycle.js
// Gestion du suivi de cycle menstruel et du journal quotidien.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── GET /api/cycle ────────────────────────────────────────────
// Retourne tous les cycles de l'utilisateur, du plus récent au plus ancien.
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, date_debut, duree_regles, duree_cycle, notes, created_at
             FROM cycles
             WHERE user_id = \$1
             ORDER BY date_debut DESC`,
            [req.user.id]
        );
        res.json({ success: true, cycles: result.rows });
    } catch (err) {
        console.error('[CYCLE] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/cycle ───────────────────────────────────────────
// Enregistre un nouveau cycle.
router.post('/', async (req, res) => {
    const { date_debut, duree_regles, duree_cycle, notes } = req.body;
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'La date de début est obligatoire.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO cycles (user_id, date_debut, duree_regles, duree_cycle, notes)
             VALUES (\$1, \$2, \$3, \$4, \$5)
             RETURNING *`,
            [req.user.id, date_debut,
             duree_regles || 5,
             duree_cycle  || 28,
             notes        || null]
        );
        res.json({ success: true, cycle: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/cycle/:id ────────────────────────────────────────
// Met à jour un cycle existant (vérification propriétaire).
router.put('/:id', async (req, res) => {
    const { date_debut, duree_regles, duree_cycle, notes } = req.body;
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'La date de début est obligatoire.' });
    }
    try {
        const result = await pool.query(
            `UPDATE cycles
             SET date_debut=\$1, duree_regles=\$2, duree_cycle=\$3, notes=\$4
             WHERE id=\$5 AND user_id=\$6
             RETURNING *`,
            [date_debut, duree_regles, duree_cycle, notes,
             req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Cycle introuvable.' });
        }
        res.json({ success: true, cycle: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/cycle/:id ─────────────────────────────────────
// Supprime un cycle (vérification propriétaire).
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cycles WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Cycle introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[CYCLE] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/cycle/journal ────────────────────────────────────
// Retourne les entrées du journal pour un mois donné.
router.get('/journal', async (req, res) => {
    const { mois, annee } = req.query;
    if (!mois || !annee) {
        return res.status(400).json({ success: false, message: 'Mois et année requis.' });
    }
    try {
        const result = await pool.query(
            `SELECT id, date, humeur, symptomes, notes, created_at
             FROM cycle_journal
             WHERE user_id = \$1
               AND EXTRACT(MONTH FROM date) = \$2
               AND EXTRACT(YEAR  FROM date) = \$3`,
            [req.user.id, mois, annee]
        );
        res.json({ success: true, journal: result.rows });
    } catch (err) {
        console.error('[CYCLE] GET /journal :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/cycle/journal ───────────────────────────────────
// Crée ou met à jour une entrée du journal (upsert par date).
// Le champ "rapport" côté front est stocké dans la colonne "humeur".
router.post('/journal', async (req, res) => {
    const { date, rapport, symptomes, notes } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: 'La date est obligatoire.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO cycle_journal (user_id, date, humeur, symptomes, notes)
             VALUES (\$1, \$2, \$3, \$4, \$5)
             ON CONFLICT (user_id, date) DO UPDATE
             SET humeur=\$3, symptomes=\$4, notes=\$5
             RETURNING *`,
            [req.user.id, date,
             rapport   || null,
             symptomes || null,
             notes     || null]
        );
        res.json({ success: true, journal: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] POST /journal :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/cycle/journal/:id ────────────────────────────
// Supprime une entrée du journal (vérification propriétaire).
router.delete('/journal/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cycle_journal WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[CYCLE] DELETE /journal/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
