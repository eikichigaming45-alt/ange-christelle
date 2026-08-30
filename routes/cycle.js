// ============================================================
// routes/cycle.js
// Gestion du suivi de cycle menstruel, journal quotidien et mood.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/cycle ────────────────────────────────────────────
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
            [req.user.id, date_debut, duree_regles || 5, duree_cycle || 28, notes || null]
        );
        res.json({ success: true, cycle: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/cycle/journal ────────────────────────────────────
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
               AND EXTRACT(YEAR  FROM date) = \$3
             ORDER BY date ASC, created_at ASC`,
            [req.user.id, mois, annee]
        );
        res.json({ success: true, journal: result.rows });
    } catch (err) {
        console.error('[CYCLE] GET /journal :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/cycle/journal ───────────────────────────────────
router.post('/journal', async (req, res) => {
    const { date, humeur, symptomes, notes } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: 'La date est obligatoire.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO cycle_journal (user_id, date, humeur, symptomes, notes)
             VALUES (\$1, \$2, \$3, \$4, \$5)
             RETURNING *`,
            [req.user.id, date, humeur || null, symptomes || null, notes || null]
        );
        res.json({ success: true, journal: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] POST /journal :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/cycle/journal/:id ────────────────────────────────
router.put('/journal/:id', async (req, res) => {
    const { humeur, symptomes, notes } = req.body;
    try {
        const result = await pool.query(
            `UPDATE cycle_journal
             SET humeur=\$1, symptomes=\$2, notes=\$3
             WHERE id=\$4 AND user_id=\$5
             RETURNING *`,
            [humeur || null, symptomes || null, notes || null, req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Rapport introuvable.' });
        }
        res.json({ success: true, journal: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] PUT /journal/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/cycle/journal/:id ────────────────────────────
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

// ── GET /api/cycle/mood ───────────────────────────────────────
router.get('/mood', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, message: 'Date requise.' });
    }
    try {
        const result = await pool.query(
            'SELECT id, date, moods FROM cycle_mood WHERE user_id=\$1 AND date=\$2',
            [req.user.id, date]
        );
        res.json({ success: true, mood: result.rows[0] || null });
    } catch (err) {
        console.error('[CYCLE] GET /mood :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/cycle/mood ──────────────────────────────────────
router.post('/mood', async (req, res) => {
    const { date, moods } = req.body;
    if (!date) {
        return res.status(400).json({ success: false, message: 'La date est obligatoire.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO cycle_mood (user_id, date, moods)
             VALUES (\$1, \$2, \$3)
             ON CONFLICT (user_id, date) DO UPDATE
             SET moods=\$3
             RETURNING *`,
            [req.user.id, date, moods || null]
        );
        res.json({ success: true, mood: result.rows[0] });
    } catch (err) {
        console.error('[CYCLE] POST /mood :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/cycle/mood/:id ────────────────────────────────
router.delete('/mood/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cycle_mood WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Mood introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[CYCLE] DELETE /mood/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/cycle/:id ────────────────────────────────────────
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
            [date_debut, duree_regles, duree_cycle, notes, req.params.id, req.user.id]
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

module.exports = router;
