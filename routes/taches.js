const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

router.get('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId manquant' });
    try {
        const result = await pool.query(`
            SELECT * FROM taches
            WHERE user_id = \$1
            ORDER BY
                CASE WHEN date IS NULL THEN 1 ELSE 0 END,
                date ASC, heure ASC NULLS LAST, created_at ASC
        `, [userId]);
        res.json({ success: true, taches: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    const { userId, titre, date, heure, recurrence, rappel_avant } = req.body;
    if (!userId || !titre) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        const result = await pool.query(`
            INSERT INTO taches (user_id, titre, date, heure, recurrence, rappel_avant)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6) RETURNING *
        `, [userId, titre, date||null, heure||null, recurrence||'none', rappel_avant||0]);
        res.json({ success: true, tache: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.put('/:id', async (req, res) => {
    const { userId, titre, date, heure, recurrence, rappel_avant } = req.body;
    if (!userId || !titre) return res.status(400).json({ success: false, message: 'Champs manquants' });
    try {
        const result = await pool.query(`
            UPDATE taches SET titre=\$1, date=\$2, heure=\$3, recurrence=\$4, rappel_avant=\$5
            WHERE id=\$6 AND user_id=\$7 RETURNING *
        `, [titre, date||null, heure||null, recurrence||'none', rappel_avant||0, req.params.id, userId]);
        if (result.rowCount === 0) return res.status(403).json({ success: false, message: 'Accès refusé' });
        res.json({ success: true, tache: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/:id/cocher', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    try {
        const t = await pool.query('SELECT * FROM taches WHERE id=\$1 AND user_id=\$2', [id, userId]);
        if (!t.rows.length) return res.status(404).json({ success: false });
        const tache = t.rows[0];
        await pool.query('UPDATE taches SET faite=TRUE WHERE id=\$1', [id]);

        if (tache.recurrence !== 'none' && tache.date) {
            const base = new Date(tache.date.toISOString().split('T')[0] + 'T00:00:00Z');
            let next = new Date(base);
            if (tache.recurrence === 'daily')   next.setDate(base.getUTCDate() + 1);
            if (tache.recurrence === 'weekly')  next.setDate(base.getUTCDate() + 7);
            if (tache.recurrence === 'monthly') next.setMonth(base.getUTCMonth() + 1);
            const nextDate = next.toISOString().split('T')[0];
            await pool.query(`
                INSERT INTO taches (user_id, titre, date, heure, recurrence, rappel_avant)
                VALUES (\$1, \$2, \$3, \$4, \$5, \$6)
            `, [userId, tache.titre, nextDate, tache.heure, tache.recurrence, tache.rappel_avant||0]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId || req.body.userId;
    try {
        await pool.query('DELETE FROM taches WHERE id=\$1 AND user_id=\$2', [id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
