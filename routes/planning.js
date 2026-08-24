// ============================================================
// routes/planning.js
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const CATEGORIES_VALIDES = ['Travail', 'Repos', 'Congé payé', 'Mission', 'Autre'];

router.use(authenticateToken);

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

router.get('/', async (req, res) => {
    const { mois, annee } = req.query;
    if (!mois || !annee) {
        return res.status(400).json({ success: false, message: 'Mois et année requis.' });
    }
    try {
        const debutMois = `${annee}-${String(mois).padStart(2, '0')}-01`;
        const finMois   = new Date(annee, mois, 0).toISOString().slice(0, 10);

        const result = await pool.query(`
            SELECT *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut_str,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin_str,
                TO_CHAR(date,       'YYYY-MM-DD') AS date_str
            FROM planning
            WHERE user_id = \$1
              AND (
                (date_fin IS NULL AND COALESCE(date_debut, date) BETWEEN \$2 AND \$3)
                OR
                (date_fin IS NOT NULL AND date_debut <= \$3 AND date_fin >= \$2)
              )
            ORDER BY COALESCE(date_debut, date) ASC
        `, [req.user.id, debutMois, finMois]);

        res.json({ success: true, planning: result.rows });
    } catch (err) {
        console.error('[PLANNING] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

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
                (date_fin IS NULL AND COALESCE(date_debut, date) = \$2)
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
            date_fin           || null,
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
            date_fin           || null,
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
