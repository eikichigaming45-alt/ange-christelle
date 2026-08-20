// ============================================================
// routes/planning.js — v3.48
// Gestion du planning — nouveau modèle métier :
// catégories : Travail, Repos, Congé payé, Mission, Autre.
// Congé payé : plage date_debut → date_fin.
// Autre : libelle_personnalise obligatoire.
// Purge lazy : entrées > 6 mois supprimées silencieusement au GET.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Catégories valides ────────────────────────────────────────
const CATEGORIES_VALIDES = ['Travail', 'Repos', 'Congé payé', 'Mission', 'Autre'];

// ── Toutes les routes nécessitent un token JWT ────────────────
router.use(authenticateToken);

// ── GET /api/planning/employeurs ──────────────────────────────
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
// Purge lazy > 6 mois, puis retourne le mois demandé.
// Pour Congé payé : retourne toutes les entrées dont la plage
// chevauche le mois demandé.
router.get('/', async (req, res) => {
    const { mois, annee } = req.query;
    if (!mois || !annee) {
        return res.status(400).json({ success: false, message: 'Mois et année requis.' });
    }
    try {
        // Purge silencieuse — entrées dont date_fin (ou date_debut) > 6 mois
        await pool.query(
            `DELETE FROM planning
             WHERE user_id = \$1
               AND COALESCE(date_fin, date_debut) < NOW() - INTERVAL '6 months'`,
            [req.user.id]
        );

        // Début et fin du mois demandé
        const debutMois = `${annee}-${String(mois).padStart(2, '0')}-01`;
        const finMois   = `${annee}-${String(mois).padStart(2, '0')}-31`;

        const result = await pool.query(`
            SELECT *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str,
                TO_CHAR(date,       'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE user_id = \$1
              AND (
                -- Entrée sur un seul jour dans le mois
                (date_fin IS NULL AND date_debut BETWEEN \$2 AND \$3)
                OR
                -- Plage de congé chevauchant le mois
                (date_fin IS NOT NULL AND date_debut <= \$3 AND date_fin >= \$2)
              )
            ORDER BY date_debut ASC
        `, [req.user.id, debutMois, finMois]);

        res.json({ success: true, planning: result.rows });
    } catch (err) {
        console.error('[PLANNING] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/planning/jour ────────────────────────────────────
// Retourne les entrées actives pour un jour précis
// (entrée ponctuelle ou plage de congé couvrant ce jour).
router.get('/jour', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, message: 'Date requise.' });
    }
    try {
        const result = await pool.query(`
            SELECT *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str,
                TO_CHAR(date,       'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE user_id = \$1
              AND (
                (date_fin IS NULL AND date_debut = \$2)
                OR
                (date_fin IS NOT NULL AND date_debut <= \$2 AND date_fin >= \$2)
              )
            ORDER BY heure_debut ASC NULLS LAST
        `, [req.user.id, date]);
        res.json({ success: true, planning: result.rows });
    } catch (err) {
        console.error('[PLANNING] GET /jour :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/planning/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str,
                TO_CHAR(date,       'YYYY-MM-DD') AS date_str
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
// Crée une nouvelle entrée.
// Congé payé : date_debut + date_fin obligatoires.
// Autre      : libelle_personnalise obligatoire.
router.post('/', async (req, res) => {
    const {
        categorie, libelle_personnalise,
        date_debut, date_fin,
        heure_debut, heure_fin,
        employeur, adresse, telephone,
        notes, rappel_avant_shift
    } = req.body;

    if (!categorie || !CATEGORIES_VALIDES.includes(categorie)) {
        return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'Date de début obligatoire.' });
    }
    if (categorie === 'Autre' && !libelle_personnalise?.trim()) {
        return res.status(400).json({ success: false, message: 'Libellé obligatoire pour la catégorie Autre.' });
    }
    if (categorie === 'Congé payé' && !date_fin) {
        return res.status(400).json({ success: false, message: 'Date de fin obligatoire pour un congé payé.' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO planning
                (user_id, categorie, libelle_personnalise,
                 date_debut, date_fin, date,
                 heure_debut, heure_fin,
                 employeur, adresse, telephone,
                 notes, rappel_avant_shift)
            VALUES (\$1,\$2,\$3,\$4,\$5,\$4,\$6,\$7,\$8,\$9,\$10,\$11,\$12)
            RETURNING *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str
        `, [
            req.user.id,
            categorie,
            libelle_personnalise?.trim() || null,
            date_debut,
            date_fin || null,
            heure_debut        || null,
            heure_fin          || null,
            employeur          || null,
            adresse            || null,
            telephone          || null,
            notes              || null,
            rappel_avant_shift || 0
        ]);
        res.json({ success: true, planning: result.rows[0] });
    } catch (err) {
        console.error('[PLANNING] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/planning/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
    const {
        categorie, libelle_personnalise,
        date_debut, date_fin,
        heure_debut, heure_fin,
        employeur, adresse, telephone,
        notes, rappel_avant_shift
    } = req.body;

    if (!categorie || !CATEGORIES_VALIDES.includes(categorie)) {
        return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'Date de début obligatoire.' });
    }
    if (categorie === 'Autre' && !libelle_personnalise?.trim()) {
        return res.status(400).json({ success: false, message: 'Libellé obligatoire pour la catégorie Autre.' });
    }
    if (categorie === 'Congé payé' && !date_fin) {
        return res.status(400).json({ success: false, message: 'Date de fin obligatoire pour un congé payé.' });
    }

    try {
        const result = await pool.query(`
            UPDATE planning SET
                categorie=\$1, libelle_personnalise=\$2,
                date_debut=\$3, date_fin=\$4, date=\$3,
                heure_debut=\$5, heure_fin=\$6,
                employeur=\$7, adresse=\$8, telephone=\$9,
                notes=\$10, rappel_avant_shift=\$11
            WHERE id=\$12 AND user_id=\$13
            RETURNING *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str
        `, [
            categorie,
            libelle_personnalise?.trim() || null,
            date_debut,
            date_fin || null,
            heure_debut        || null,
            heure_fin          || null,
            employeur          || null,
            adresse            || null,
            telephone          || null,
            notes              || null,
            rappel_avant_shift || 0,
            req.params.id,
            req.user.id
        ]);
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
