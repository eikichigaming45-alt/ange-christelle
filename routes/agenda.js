// ============================================================
// routes/agenda.js
// Agenda unifié — agrège planning (7 jours), rendez-vous futurs
// et tâches non faites, triés par date croissante.
// GET /api/agenda
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
    const userId = req.user.id;

    try {
        const aujourd_hui = new Date();
        const dans7jours  = new Date();
        dans7jours.setDate(aujourd_hui.getDate() + 7);

        const dateDebut = aujourd_hui.toISOString().split('T')[0];
        const dateFin   = dans7jours.toISOString().split('T')[0];

        // Planning — entrées couvrant les 7 prochains jours
        const resPlan = await pool.query(
            `SELECT id, categorie, libelle_personnalise, heure_debut, heure_fin,
                    employeur,
                    TO_CHAR(COALESCE(date_debut, date), 'YYYY-MM-DD') AS date_str
             FROM planning
             WHERE user_id = \$1
               AND (
                 (date_fin IS NULL AND COALESCE(date_debut, date) BETWEEN \$2 AND \$3)
                 OR
                 (date_fin IS NOT NULL AND date_debut <= \$3 AND date_fin >= \$2)
               )
             ORDER BY COALESCE(date_debut, date) ASC, heure_debut ASC NULLS LAST`,
            [userId, dateDebut, dateFin]
        );

        // Rendez-vous futurs
        const resRdv = await pool.query(
            `SELECT id, titre, date_rdv, praticien, lieu, type_rdv
             FROM rendezvous
             WHERE user_id = \$1
               AND date_rdv >= NOW()
             ORDER BY date_rdv ASC`,
            [userId]
        );

        // Tâches non faites avec date
        const resTaches = await pool.query(
            `SELECT id, titre, date, heure
             FROM taches
             WHERE user_id = \$1
               AND faite = FALSE
               AND date IS NOT NULL
               AND date >= \$2
             ORDER BY date ASC, heure ASC NULLS LAST`,
            [userId, dateDebut]
        );

        // Normalisation en items communs
        const items = [];

        resPlan.rows.forEach(p => {
            items.push({
                type      : 'planning',
                id        : p.id,
                date      : p.date_str,
                heure     : p.heure_debut ? p.heure_debut.slice(0, 5) : null,
                titre     : p.libelle_personnalise || p.categorie,
                sous_titre: p.employeur || null,
                categorie : p.categorie
            });
        });

        resRdv.rows.forEach(r => {
            const d = new Date(r.date_rdv);
            items.push({
                type      : 'rdv',
                id        : r.id,
                date      : d.toISOString().split('T')[0],
                heure     : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
                titre     : r.titre,
                sous_titre: r.praticien ? `Dr. ${r.praticien}` : (r.lieu || null),
                categorie : r.type_rdv || 'Autre'
            });
        });

        resTaches.rows.forEach(t => {
            items.push({
                type      : 'tache',
                id        : t.id,
                date      : t.date instanceof Date
                    ? t.date.toISOString().split('T')[0]
                    : String(t.date).split('T')[0],
                heure     : t.heure ? t.heure.slice(0, 5) : null,
                titre     : t.titre,
                sous_titre: null,
                categorie : null
            });
        });

        // Tri global par date puis heure
        items.sort((a, b) => {
            const da = a.date + (a.heure || '00:00');
            const db = b.date + (b.heure || '00:00');
            return da < db ? -1 : da > db ? 1 : 0;
        });

        res.json({ success: true, items });

    } catch (err) {
        console.error('[AGENDA] GET / :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
