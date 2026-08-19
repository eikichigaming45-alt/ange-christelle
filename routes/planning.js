// ============================================================
// routes/planning.js
// Gestion du planning (shifts/horaires) et des employeurs.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── GET /api/planning/employeurs ──────────────────────────────
// Retourne la liste des employeurs de l'utilisateur.
router.get('/employeurs', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, nom FROM planning_employeurs WHERE user_id = \$1 ORDER BY nom ASC',
            [req.user.id]
        );
        res.json({ success: true, employeurs: rows });
    } catch (err) {
        console.error('[PLANNING] GET /employeurs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/planning/employeurs ─────────────────────────────
// Ajoute un employeur (ignoré silencieusement si déjà existant).
router.post('/employeurs', async (req, res) => {
    const { nom } = req.body;
    if (!nom?.trim()) {
        return res.status(400).json({ success: false, message: 'Nom requis.' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO planning_employeurs (user_id, nom)
             VALUES (\$1, \$2)
             ON CONFLICT (user_id, nom) DO NOTHING
             RETURNING *`,
            [req.user.id, nom.trim()]
        );
        res.json({ success: true, employeur: rows[0] || null });
    } catch (err) {
        console.error('[PLANNING] POST /employeurs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/planning/employeurs/:id ───────────────────────
// Supprime un employeur (vérification propriétaire).
router.delete('/employeurs/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM planning_employeurs WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Employeur introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[PLANNING] DELETE /employeurs/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/planning ─────────────────────────────────────────
// Retourne les entrées du planning pour un mois donné.
router.get('/', async (req, res) => {
    const { mois, annee } = req.query;
    if (!mois || !annee) {
        return res.status(400).json({ success: false, message: 'Mois et année requis.' });
    }
    try {
        const result = await pool.query(`
            SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE user_id = \$1
              AND EXTRACT(MONTH FROM date) = \$2
              AND EXTRACT(YEAR  FROM date) = \$3
            ORDER BY date ASC
        `, [req.user.id, mois, annee]);
        res.json({ success: true, planning: result.rows });
    } catch (err) {
        console.error('[PLANNING] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/planning/jour ────────────────────────────────────
// Retourne les entrées du planning pour un jour précis.
router.get('/jour', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, message: 'Date requise.' });
    }
    try {
        const result = await pool.query(`
            SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE user_id = \$1 AND date = \$2
            ORDER BY heure_debut ASC
        `, [req.user.id, date]);
        res.json({ success: true, planning: result.rows });
    } catch (err) {
        console.error('[PLANNING] GET /jour :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/planning/:id ─────────────────────────────────────
// Retourne une entrée précise du planning.
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE id = \$1 AND user_id = \$2
        `, [req.params.id, req.user.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true, entry: result.rows[0] });
    } catch (err) {
        console.error('[PLANNING] GET /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/planning ────────────────────────────────────────
// Crée une nouvelle entrée de planning.
router.post('/', async (req, res) => {
    const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
    if (!date || !type) {
        return res.status(400).json({ success: false, message: 'Date et type sont obligatoires.' });
    }
    try {
        const result = await pool.query(`
            INSERT INTO planning
                (user_id, date, type, heure_debut, heure_fin,
                 employeur, adresse, telephone, notes, rappel_avant)
            VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10)
            RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date_str
        `, [req.user.id, date, type,
            heure_debut  || null, heure_fin   || null,
            employeur    || null, adresse     || null,
            telephone    || null, notes       || null,
            rappel_avant || 120]);
        res.json({ success: true, planning: result.rows[0] });
    } catch (err) {
        console.error('[PLANNING] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/planning/:id ─────────────────────────────────────
// Met à jour une entrée de planning (vérification propriétaire).
router.put('/:id', async (req, res) => {
    const { date, type, heure_debut, heure_fin, employeur, adresse, telephone, notes, rappel_avant } = req.body;
    if (!date || !type) {
        return res.status(400).json({ success: false, message: 'Date et type sont obligatoires.' });
    }
    try {
        const result = await pool.query(`
            UPDATE planning
            SET date=\$1, type=\$2, heure_debut=\$3, heure_fin=\$4,
                employeur=\$5, adresse=\$6, telephone=\$7, notes=\$8, rappel_avant=\$9
            WHERE id=\$10 AND user_id=\$11
            RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date_str
        `, [date, type,
            heure_debut  || null, heure_fin   || null,
            employeur    || null, adresse     || null,
            telephone    || null, notes       || null,
            rappel_avant || 120,
            req.params.id, req.user.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true, planning: result.rows[0] });
    } catch (err) {
        console.error('[PLANNING] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/planning/:id ──────────────────────────────────
// Supprime une entrée de planning (vérification propriétaire).
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM planning WHERE id=\$1 AND user_id=\$2',
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[PLANNING] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
