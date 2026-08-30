// ============================================================
// routes/agenda.js
// CRUD agenda unifié — événements, rendez-vous, shifts.
// Gestion employeurs et catégories personnalisées mémorisées.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Catégories et sous-catégories de base ─────────────────────
// Triées alphabétiquement, Autre toujours en dernier
const CATEGORIES = ['Administratif', 'Autre', 'Famille', 'Médical', 'Mission', 'Repos', 'Sortie', 'Sport', 'Travail', 'Voyage'];

const SOUS_CATEGORIES = {
    'Administratif' : ['Assurance', 'Banque', 'Mairie', 'Préfecture', 'Autre'],
    'Autre'         : [],
    'Famille'       : ['Autre'],
    'Médical'       : ['Dentiste', 'Dermatologue', 'Généraliste', 'Gynécologue', 'Kinésithérapeute', 'Ophtalmologue', 'Urgences', 'Autre'],
    'Mission'       : ['Déplacement', 'Mission', 'Autre'],
    'Repos'         : ['Arrêt maladie', 'Congé payé', 'Repos', 'RTT', 'Autre'],
    'Sortie'        : ['Cinéma', 'Concert', 'En famille', 'Entre amis', 'Restaurant', 'Autre'],
    'Sport'         : ['Course à pied', 'Piscine', 'Salle de sport', 'Vélo', 'Autre'],
    'Travail'       : ['CDD', 'CDI', 'Formation', 'Intérim', 'Autre'],
    'Voyage'        : ['Autre']
};

router.use(authenticateToken);

// ── GET /api/agenda/categories ────────────────────────────────
// Retourne catégories de base + sous-catégories personnalisées
router.get('/categories', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT niveau, nom FROM agenda_categories WHERE user_id = \$1 ORDER BY nom ASC`,
            [req.user.id]
        );

        const sousPerso = {};
        rows.forEach(r => {
            if (!sousPerso[r.niveau]) sousPerso[r.niveau] = [];
            sousPerso[r.niveau].push(r.nom);
        });

        const sousFinal = {};
        Object.keys(SOUS_CATEGORIES).forEach(cat => {
            const base      = SOUS_CATEGORIES[cat];
            const perso     = sousPerso[cat] || [];
            const tout      = [...new Set([...base, ...perso])];
            const sansAutre = tout.filter(v => v !== 'Autre').sort((a, b) =>
                a.localeCompare(b, 'fr', { sensitivity: 'base' })
            );
            sousFinal[cat] = tout.includes('Autre') ? [...sansAutre, 'Autre'] : sansAutre;
        });

        res.json({ success: true, categories: CATEGORIES, sous_categories: sousFinal });
    } catch (err) {
        console.error('[AGENDA] GET /categories :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/agenda/categories ───────────────────────────────
// Mémorise une sous-catégorie personnalisée
router.post('/categories', async (req, res) => {
    const { niveau, nom } = req.body;
    if (!niveau || !nom?.trim()) {
        return res.status(400).json({ success: false, message: 'Niveau et nom requis.' });
    }
    try {
        await pool.query(
            `INSERT INTO agenda_categories (user_id, niveau, nom)
             VALUES (\$1, \$2, \$3)
             ON CONFLICT (user_id, niveau, nom) DO NOTHING`,
            [req.user.id, niveau, nom.trim()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[AGENDA] POST /categories :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/agenda/employeurs ────────────────────────────────
router.get('/employeurs', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nom, adresse, telephone FROM agenda_employeurs WHERE user_id = \$1 ORDER BY nom ASC`,
            [req.user.id]
        );
        res.json({ success: true, employeurs: rows });
    } catch (err) {
        console.error('[AGENDA] GET /employeurs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/agenda/employeurs ───────────────────────────────
router.post('/employeurs', async (req, res) => {
    const { nom, adresse, telephone } = req.body;
    if (!nom?.trim()) {
        return res.status(400).json({ success: false, message: 'Nom requis.' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO agenda_employeurs (user_id, nom, adresse, telephone)
             VALUES (\$1, \$2, \$3, \$4)
             ON CONFLICT (user_id, nom) DO UPDATE SET adresse = \$3, telephone = \$4
             RETURNING *`,
            [req.user.id, nom.trim(), adresse || null, telephone || null]
        );
        res.json({ success: true, employeur: rows[0] });
    } catch (err) {
        console.error('[AGENDA] POST /employeurs :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/agenda/employeurs/:id ─────────────────────────
router.delete('/employeurs/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM agenda_employeurs WHERE id = \$1 AND user_id = \$2`,
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Employeur introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[AGENDA] DELETE /employeurs/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/agenda ───────────────────────────────────────────
// Paramètres optionnels : date_debut, date_fin (YYYY-MM-DD)
// Sans paramètres : retourne les 90 prochains jours
router.get('/', async (req, res) => {
    try {
        const debut = req.query.date_debut || new Date().toISOString().slice(0, 10);
        const fin   = req.query.date_fin   || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { rows } = await pool.query(
            `SELECT
                id, titre, categorie, sous_categorie,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin,
                TO_CHAR(heure_debut, 'HH24:MI')   AS heure_debut,
                TO_CHAR(heure_fin,   'HH24:MI')   AS heure_fin,
                lieu, notes, rappel_avant, created_at
             FROM agenda
             WHERE user_id = \$1
               AND (
                 (date_fin IS NULL AND date_debut BETWEEN \$2 AND \$3)
                 OR
                 (date_fin IS NOT NULL AND date_debut <= \$3 AND date_fin >= \$2)
               )
             ORDER BY date_debut ASC, heure_debut ASC NULLS LAST`,
            [req.user.id, debut, fin]
        );
        res.json({ success: true, agenda: rows });
    } catch (err) {
        console.error('[AGENDA] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/agenda/widget ────────────────────────────────────
// 3 prochains jours avec entrée.
// Si entrées hors-Repos → toutes affichées.
// Si seulement Repos → Repos affiché.
router.get('/widget', async (req, res) => {
    try {
        const aujourd_hui = new Date().toISOString().slice(0, 10);
        const dans30j     = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const { rows } = await pool.query(
            `SELECT
                id, titre, categorie, sous_categorie,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin,
                TO_CHAR(heure_debut, 'HH24:MI')   AS heure_debut,
                TO_CHAR(heure_fin,   'HH24:MI')   AS heure_fin,
                lieu, notes, rappel_avant
             FROM agenda
             WHERE user_id = \$1
               AND date_debut >= \$2
               AND COALESCE(date_fin, date_debut) <= \$3
             ORDER BY date_debut ASC, heure_debut ASC NULLS LAST`,
            [req.user.id, aujourd_hui, dans30j]
        );

        const parJour = {};
        rows.forEach(e => {
            const d = e.date_debut;
            if (!parJour[d]) parJour[d] = [];
            parJour[d].push(e);
        });

        const jours  = Object.keys(parJour).sort();
        const result = [];

        for (const jour of jours) {
            if (result.length >= 3) break;
            const entries   = parJour[jour];
            const horsRepos = entries.filter(e => e.categorie !== 'Repos');
            // Si entrées hors-Repos → toutes affichées
            // Sinon → le Repos seul
            const entrees = horsRepos.length > 0 ? horsRepos : [entries[0]];
            result.push({ date: jour, entrees });
        }

        res.json({ success: true, jours: result });
    } catch (err) {
        console.error('[AGENDA] GET /widget :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/agenda/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                id, titre, categorie, sous_categorie,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin,
                TO_CHAR(heure_debut, 'HH24:MI')   AS heure_debut,
                TO_CHAR(heure_fin,   'HH24:MI')   AS heure_fin,
                lieu, notes, rappel_avant, created_at
             FROM agenda
             WHERE id = \$1 AND user_id = \$2`,
            [req.params.id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true, entree: rows[0] });
    } catch (err) {
        console.error('[AGENDA] GET /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/agenda ──────────────────────────────────────────
router.post('/', async (req, res) => {
    const {
        titre, categorie, sous_categorie,
        date_debut, date_fin,
        heure_debut, heure_fin,
        lieu, notes, rappel_avant
    } = req.body;

    if (!titre?.trim()) {
        return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });
    }
    if (!categorie || !CATEGORIES.includes(categorie)) {
        return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'La date de début est obligatoire.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO agenda
                (user_id, titre, categorie, sous_categorie,
                 date_debut, date_fin, heure_debut, heure_fin,
                 lieu, notes, rappel_avant)
             VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10,\$11)
             RETURNING *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin,
                TO_CHAR(heure_debut, 'HH24:MI')   AS heure_debut,
                TO_CHAR(heure_fin,   'HH24:MI')   AS heure_fin`,
            [
                req.user.id,
                titre.trim(),
                categorie,
                sous_categorie || null,
                date_debut,
                date_fin       || null,
                heure_debut    || null,
                heure_fin      || null,
                lieu           || null,
                notes          || null,
                rappel_avant   || 0
            ]
        );
        res.json({ success: true, entree: rows[0] });
    } catch (err) {
        console.error('[AGENDA] POST / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/agenda/:id ───────────────────────────────────────
router.put('/:id', async (req, res) => {
    const {
        titre, categorie, sous_categorie,
        date_debut, date_fin,
        heure_debut, heure_fin,
        lieu, notes, rappel_avant
    } = req.body;

    if (!titre?.trim()) {
        return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });
    }
    if (!categorie || !CATEGORIES.includes(categorie)) {
        return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }
    if (!date_debut) {
        return res.status(400).json({ success: false, message: 'La date de début est obligatoire.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE agenda SET
                titre          = \$1,
                categorie      = \$2,
                sous_categorie = \$3,
                date_debut     = \$4,
                date_fin       = \$5,
                heure_debut    = \$6,
                heure_fin      = \$7,
                lieu           = \$8,
                notes          = \$9,
                rappel_avant   = \$10
             WHERE id = \$11 AND user_id = \$12
             RETURNING *,
                TO_CHAR(date_debut, 'YYYY-MM-DD') AS date_debut,
                TO_CHAR(date_fin,   'YYYY-MM-DD') AS date_fin,
                TO_CHAR(heure_debut, 'HH24:MI')   AS heure_debut,
                TO_CHAR(heure_fin,   'HH24:MI')   AS heure_fin`,
            [
                titre.trim(),
                categorie,
                sous_categorie || null,
                date_debut,
                date_fin       || null,
                heure_debut    || null,
                heure_fin      || null,
                lieu           || null,
                notes          || null,
                rappel_avant   || 0,
                req.params.id,
                req.user.id
            ]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true, entree: rows[0] });
    } catch (err) {
        console.error('[AGENDA] PUT /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/agenda/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM agenda WHERE id = \$1 AND user_id = \$2`,
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Entrée introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[AGENDA] DELETE /:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
