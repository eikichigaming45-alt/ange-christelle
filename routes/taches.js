// ============================================================
// routes/taches.js
// CRUD des tâches utilisateur + gestion des récurrences.
// Tâches récurrentes : nouvelle occurrence créée à la validation.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/taches ───────────────────────────────────────────
// Retourne toutes les tâches triées : datées ASC, sans date en fin.
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, titre, date, heure, recurrence, rappel_avant, faite, created_at
            FROM taches
            WHERE user_id = \\$1
            ORDER BY
                CASE WHEN date IS NULL THEN 1 ELSE 0 END,
                date ASC, heure ASC NULLS LAST, created_at ASC
        `, [req.user.id]);
        res.json({ success: true, taches: result.rows });
    } catch (err) {
        console.error('[TACHES] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/taches ──────────────────────────────────────────
// Crée une nouvelle tâche.
router.post('/', async (req, res) => {
    const { titre, date, heure, recurrence, rappel_avant } = req.body;
    if (!titre) {
        return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO taches (user_id, titre, date, heure, recurrence, rappel_avant)
            VALUES (\\$1, \\$2, \\$3, \\$4, \\$5, \\$6) RETURNING *
        `, [req.user.id, titre, date || null, heure || null,
            recurrence || 'none', rappel_avant || 0]);
        res.json({ success: true, tache: result.rows[0] });
    } catch (err) {
        console.error('[TACHES] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/taches/:id ───────────────────────────────────────
// Met à jour une tâche (vérification propriétaire).
router.put('/:id', async (req, res) => {
    const { titre, date, heure, recurrence, rappel_avant } = req.body;
    if (!titre) {
        return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });
    }
    try {
        const result = await pool.query(`
            UPDATE taches
            SET titre=\\$1, date=\\$2, heure=\\$3, recurrence=\\$4, rappel_avant=\\$5
            WHERE id=\\$6 AND user_id=\\$7
            RETURNING *
        `, [titre, date || null, heure || null,
            recurrence || 'none', rappel_avant || 0,
            req.params.id, req.user.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Tâche introuvable.' });
        }
        res.json({ success: true, tache: result.rows[0] });
    } catch (err) {
        console.error('[TACHES] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/taches/:id/cocher ───────────────────────────────
// Marque une tâche comme faite et crée la prochaine occurrence si récurrente.
router.post('/:id/cocher', async (req, res) => {
    const { id } = req.params;
    try {
        const t = await pool.query(
            `SELECT id, titre, date, heure, recurrence, rappel_avant
             FROM taches WHERE id=\\$1 AND user_id=\\$2`,
            [id, req.user.id]
        );
        if (!t.rows.length) {
            return res.status(404).json({ success: false, message: 'Tâche introuvable.' });
        }
        const tache = t.rows[0];
        await pool.query('UPDATE taches SET faite=TRUE WHERE id=\\$1', [id]);

        if (tache.recurrence !== 'none' && tache.date) {
            const base = new Date(tache.date.toISOString().split('T')[0] + 'T00:00:00Z');
            const next = new Date(base);
            if (tache.recurrence === 'daily')   next.setDate(base.getUTCDate() + 1);
            if (tache.recurrence === 'weekly')  next.setDate(base.getUTCDate() + 7);
            if (tache.recurrence === 'monthly') next.setMonth(base.getUTCMonth() + 1);
            await pool.query(`
                INSERT INTO taches (user_id, titre, date, heure, recurrence, rappel_avant)
                VALUES (\\$1, \\$2, \\$3, \\$4, \\$5, \\$6)
            `, [req.user.id, tache.titre,
                next.toISOString().split('T')[0],
                tache.heure, tache.recurrence,
                tache.rappel_avant || 0]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[TACHES] POST /:id/cocher :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/taches/:id ────────────────────────────────────
// Supprime une tâche (vérification propriétaire).
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM taches WHERE id=\\$1 AND user_id=\\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Tâche introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[TACHES] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
