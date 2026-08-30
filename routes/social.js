// ============================================================
// routes/social.js
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const Groq     = require('groq-sdk');
const { authenticateToken } = require('../middleware/auth');
const { envoyerPush }       = require('./push');

let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

router.use(authenticateToken);

// ============================================================
// RECHERCHE UTILISATEURS
// ============================================================

router.get('/users/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
        return res.json({ success: true, users: [] });
    }
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, p.prenom, p.nom, p.photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id != \$1
              AND (
                u.username            ILIKE \$2
                OR unaccent(p.prenom) ILIKE unaccent(\$2)
                OR unaccent(p.nom)    ILIKE unaccent(\$2)
              )
            ORDER BY u.username ASC
            LIMIT 20
        `, [req.user.id, `%${q}%`]);
        res.json({ success: true, users: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /users/search :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// PARTAGES
// ============================================================

router.get('/partages/miens', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT s.id, s.viewer_id, s.resource_type, s.active, s.created_at,
                   u.username, p.prenom, p.nom, p.photo
            FROM shares s
            JOIN users u ON u.id = s.viewer_id
            LEFT JOIN profiles p ON p.user_id = s.viewer_id
            WHERE s.owner_id = \$1
            ORDER BY u.username ASC, s.resource_type ASC
        `, [req.user.id]);
        res.json({ success: true, partages: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /partages/miens :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.get('/partages/recus', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT s.id, s.owner_id, s.resource_type, s.active, s.created_at,
                   u.username, p.prenom, p.nom, p.photo, p.sexe
            FROM shares s
            JOIN users u ON u.id = s.owner_id
            LEFT JOIN profiles p ON p.user_id = s.owner_id
            WHERE s.viewer_id = \$1 AND s.active = TRUE
            ORDER BY s.created_at DESC
        `, [req.user.id]);
        res.json({ success: true, partages: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /partages/recus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.post('/partages', async (req, res) => {
    const { viewer_id, resource_type } = req.body;
    const typesValides = ['cycle', 'agenda', 'taches'];
    if (!viewer_id || !typesValides.includes(resource_type)) {
        return res.status(400).json({ success: false, message: 'Données invalides.' });
    }
    if (parseInt(viewer_id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Impossible de partager avec soi-même.' });
    }

    if (resource_type === 'cycle') {
        try {
            const { rows } = await pool.query(
                'SELECT sexe FROM profiles WHERE user_id = \$1', [req.user.id]
            );
            const sexe = rows[0]?.sexe ?? null;
            if (sexe === 'homme') {
                return res.status(403).json({
                    success: false,
                    message: 'Le partage du cycle est réservé aux femmes et aux personnes intersexes.'
                });
            }
        } catch (err) {
            console.error('[SOCIAL] Guard cycle :', err.message);
            return res.status(500).json({ success: false, message: 'Erreur serveur.' });
        }
    }

    try {
        const { rows } = await pool.query(`
            INSERT INTO shares (owner_id, viewer_id, resource_type, active)
            VALUES (\$1, \$2, \$3, TRUE)
            ON CONFLICT (owner_id, viewer_id, resource_type) DO UPDATE SET active = TRUE
            RETURNING *
        `, [req.user.id, viewer_id, resource_type]);

        await pool.query(`
            INSERT INTO notifications (user_id, type, ref_id, sender_id)
            VALUES (\$1, 'share_request', \$2, \$3)
        `, [viewer_id, rows[0].id, req.user.id]);

        const senderProfil = await pool.query(
            'SELECT prenom, nom FROM profiles WHERE user_id = \$1', [req.user.id]
        );
        const prenom = senderProfil.rows[0]?.prenom || 'Quelqu\'un';
        const nom    = senderProfil.rows[0]?.nom    || '';
        await envoyerPush(
            parseInt(viewer_id),
            '🔗 Nouveau partage',
            `${prenom}${nom ? ' ' + nom : ''} a partagé ses données avec toi`,
            `share-${rows[0].id}`
        );

        res.json({ success: true, partage: rows[0] });
    } catch (err) {
        console.error('[SOCIAL] POST /partages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/partages/:id', async (req, res) => {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Valeur active invalide.' });
    }
    try {
        const { rowCount } = await pool.query(`
            UPDATE shares SET active = \$1
            WHERE id = \$2 AND owner_id = \$3
        `, [active, req.params.id, req.user.id]);
        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Partage introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] PATCH /partages/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.delete('/partages/:id', async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            'DELETE FROM shares WHERE id = \$1 AND owner_id = \$2',
            [req.params.id, req.user.id]
        );
        if (rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Partage introuvable.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] DELETE /partages/:id :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// DONNÉES PARTAGÉES — agenda, taches
// ============================================================

router.get('/data/:ownerId/:type', async (req, res) => {
    const ownerId      = parseInt(req.params.ownerId);
    const type         = req.params.type;
    const typesValides = ['agenda', 'taches'];

    if (!typesValides.includes(type)) {
        return res.status(400).json({ success: false, message: 'Type invalide.' });
    }
    try {
        const partage = await pool.query(`
            SELECT id FROM shares
            WHERE owner_id = \$1 AND viewer_id = \$2
              AND resource_type = \$3 AND active = TRUE
        `, [ownerId, req.user.id, type]);

        if (!partage.rows.length) {
            return res.status(403).json({ success: false, message: 'Partage non actif.' });
        }

        const today    = new Date().toISOString().split('T')[0];
        const dateFin  = new Date();
        dateFin.setDate(dateFin.getDate() + 4);
        const dateFinStr = dateFin.toISOString().split('T')[0];

        let data = [];

        if (type === 'agenda') {
            const { rows } = await pool.query(`
                SELECT id, titre, categorie, sous_categorie,
                       TO_CHAR(date_debut, 'YYYY-MM-DD')  AS date_debut,
                       TO_CHAR(heure_debut, 'HH24:MI')    AS heure_debut,
                       TO_CHAR(heure_fin,   'HH24:MI')    AS heure_fin,
                       lieu
                FROM agenda
                WHERE user_id = \$1
                  AND date_debut >= \$2
                  AND date_debut <= \$3
                ORDER BY date_debut ASC, heure_debut ASC NULLS LAST
                LIMIT 30
            `, [ownerId, today, dateFinStr]);
            data = rows;
        }

        if (type === 'taches') {
            const { rows } = await pool.query(`
                SELECT id, titre, date, heure, faite, recurrence
                FROM taches
                WHERE user_id = \$1
                  AND faite = FALSE
                  AND date = \$2
                ORDER BY heure ASC NULLS LAST
            `, [ownerId, today]);
            data = rows;
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('[SOCIAL] GET /data :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// COUCOU
// ============================================================

router.post('/coucou/:userId', async (req, res) => {
    const receiverId = parseInt(req.params.userId);
    if (receiverId === req.user.id) {
        return res.status(400).json({ success: false, message: 'Impossible de s\'envoyer un coucou.' });
    }
    const content = "Coucou, tu n'as pas encore renseigné ton mood aujourd'hui, comment tu vas ? 💕";
    try {
        const { rows } = await pool.query(`
            INSERT INTO private_messages (sender_id, receiver_id, content)
            VALUES (\$1, \$2, \$3)
            RETURNING id
        `, [req.user.id, receiverId, content]);

        await pool.query(`
            INSERT INTO notifications (user_id, type, ref_id, sender_id)
            VALUES (\$1, 'coucou', \$2, \$3)
        `, [receiverId, rows[0].id, req.user.id]);

        const senderProfil = await pool.query(
            'SELECT prenom, nom FROM profiles WHERE user_id = \$1', [req.user.id]
        );
        const prenom = senderProfil.rows[0]?.prenom || 'Quelqu\'un';
        const nom    = senderProfil.rows[0]?.nom    || '';
        await envoyerPush(
            receiverId,
            '👋 Coucou !',
            `${prenom}${nom ? ' ' + nom : ''} t'a envoyé un coucou`,
            `coucou-${rows[0].id}`
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] POST /coucou :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// MESSAGES PRIVÉS
// ============================================================

router.get('/messages', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT pm.id, pm.sender_id, pm.receiver_id, pm.content, pm.seen, pm.created_at,
                   ps.prenom AS sender_prenom, ps.nom AS sender_nom, ps.photo AS sender_photo,
                   pr.prenom AS receiver_prenom, pr.nom AS receiver_nom
            FROM private_messages pm
            LEFT JOIN profiles ps ON ps.user_id = pm.sender_id
            LEFT JOIN profiles pr ON pr.user_id = pm.receiver_id
            WHERE pm.sender_id = \$1 OR pm.receiver_id = \$1
            ORDER BY pm.created_at DESC
        `, [req.user.id]);
        res.json({ success: true, messages: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/messages/:id/vu', async (req, res) => {
    try {
        await pool.query(
            'UPDATE private_messages SET seen = TRUE WHERE id = \$1 AND receiver_id = \$2',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] PATCH /messages/:id/vu :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

router.get('/notifications/count', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = \$1 AND seen = FALSE',
            [req.user.id]
        );
        res.json({ success: true, count: parseInt(rows[0].count) });
    } catch (err) {
        console.error('[SOCIAL] GET /notifications/count :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.get('/notifications', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT n.id, n.type, n.ref_id, n.seen, n.created_at, n.sender_id,
                   p.prenom AS sender_prenom, p.nom AS sender_nom, p.photo AS sender_photo
            FROM notifications n
            LEFT JOIN profiles p ON p.user_id = n.sender_id
            WHERE n.user_id = \$1
            ORDER BY n.created_at DESC
            LIMIT 10
        `, [req.user.id]);
        res.json({ success: true, notifications: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /notifications :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/notifications/tout-vu', async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET seen = TRUE WHERE user_id = \$1',
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] PATCH /notifications/tout-vu :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.patch('/notifications/:id/vu', async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET seen = TRUE WHERE id = \$1 AND user_id = \$2',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL] PATCH /notifications/:id/vu :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ============================================================
// CONSEIL CYCLE (Groq)
// ============================================================

router.get('/conseil/:ownerId', async (req, res) => {
    const ownerId = parseInt(req.params.ownerId);
    try {
        const partage = await pool.query(`
            SELECT id FROM shares
            WHERE owner_id = \$1 AND viewer_id = \$2
              AND resource_type = 'cycle' AND active = TRUE
        `, [ownerId, req.user.id]);
        if (!partage.rows.length) {
            return res.status(403).json({ success: false, message: 'Partage cycle non actif.' });
        }

        const today   = new Date().toISOString().split('T')[0];
        const moodRes = await pool.query(
            'SELECT moods FROM cycle_mood WHERE user_id = \$1 AND date = \$2',
            [ownerId, today]
        );

        const cycleRes = await pool.query(
            'SELECT date_debut, duree_regles, duree_cycle FROM cycles WHERE user_id = \$1 ORDER BY date_debut DESC LIMIT 1',
            [ownerId]
        );

        let cycleInfo = null;
        let phase     = 'luteale';

        if (cycleRes.rows.length) {
            const debut       = new Date(cycleRes.rows[0].date_debut);
            debut.setHours(0, 0, 0, 0);
            const dureeRegles = cycleRes.rows[0].duree_regles || 5;
            const dureeCycle  = cycleRes.rows[0].duree_cycle  || 28;
            const now         = new Date(); now.setHours(0, 0, 0, 0);
            const jourCycle   = Math.floor((now - debut) / (1000 * 60 * 60 * 24)) + 1;
            const ovulationJ  = dureeCycle - 14;

            const addDays = (d, n) => {
                const r = new Date(d);
                r.setDate(r.getDate() + n);
                r.setHours(0, 0, 0, 0);
                return r;
            };
            const fmt = d => new Date(d).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'long'
            });

            const finRegles     = addDays(debut, dureeRegles - 1);
            const debutFertile  = addDays(debut, dureeCycle - 16);
            const finFertile    = addDays(debut, dureeCycle - 12);
            const ovulation     = addDays(debut, dureeCycle - 14);
            const prochainDebut = addDays(debut, dureeCycle);
            const joursAvant    = Math.round((prochainDebut - now) / (1000 * 60 * 60 * 24));
            const enRegles      = now >= debut && now <= finRegles;
            const enFenetre     = now >= debutFertile && now <= finFertile;
            const estOvulation  = now.getTime() === ovulation.getTime();

            if (jourCycle <= dureeRegles)                                        phase = 'regles';
            else if (jourCycle < ovulationJ - 2)                                 phase = 'folliculaire';
            else if (jourCycle >= ovulationJ - 2 && jourCycle <= ovulationJ + 1) phase = 'ovulation';
            else                                                                  phase = 'luteale';

            const phaseLabels = {
                regles      : '🔴 Règles en cours',
                folliculaire: '🌱 Phase folliculaire',
                ovulation   : '🌟 Jour d\'ovulation',
                luteale     : '🌙 Phase lutéale'
            };

            let labelOvulation, valeurOvulation, labelFenetre, valeurFenetre;
            if (ovulation < now) {
                const prochaineOvul = addDays(ovulation, dureeCycle);
                const prochFertDeb  = addDays(prochaineOvul, -5);
                const prochFertFin  = addDays(prochaineOvul, 1);
                labelOvulation  = 'Prochaine ovulation';
                valeurOvulation = fmt(prochaineOvul);
                labelFenetre    = 'Prochaine fenêtre fertile';
                valeurFenetre   = `${fmt(prochFertDeb)} → ${fmt(prochFertFin)}`;
            } else {
                labelOvulation  = 'Ovulation estimée';
                valeurOvulation = fmt(ovulation);
                labelFenetre    = 'Fenêtre fertile';
                valeurFenetre   = `${fmt(debutFertile)} → ${fmt(finFertile)}`;
            }

            cycleInfo = {
                phaseLabel      : phaseLabels[phase] || phase,
                jourCycle,
                dureeCycle,
                enRegles,
                enFenetre,
                estOvulation,
                joursAvantRegles: joursAvant,
                finRegles       : enRegles ? fmt(finRegles) : null,
                labelOvulation,
                valeurOvulation,
                labelFenetre,
                valeurFenetre,
                prochainDebut   : fmt(prochainDebut)
            };
        }

        if (!moodRes.rows.length || !moodRes.rows[0].moods) {
            return res.json({ success: true, conseil: null, moodRempli: false, cycleInfo });
        }

        const moodsCoches = moodRes.rows[0].moods.split(',').filter(Boolean);

        const conseilsRes = await pool.query(
            'SELECT conseil, mood_tags FROM cycle_advice WHERE phase = \$1',
            [phase]
        );
        const conseilsMatches = conseilsRes.rows.filter(r =>
            r.mood_tags.some(tag => moodsCoches.includes(tag))
        );
        const conseilsTextes = conseilsMatches.length
            ? conseilsMatches.map(r => r.conseil)
            : conseilsRes.rows.map(r => r.conseil);

        if (!groq) {
            return res.json({
                success: true, conseil: conseilsTextes[0] || null,
                moodRempli: true, moods: moodsCoches, phase, cycleInfo
            });
        }

        const prompt = `Tu es un assistant bienveillant. Une femme a coché ces humeurs aujourd'hui : ${moodsCoches.join(', ')}. 
Voici des conseils individuels sur comment se comporter avec elle : 
${conseilsTextes.join('\n')}
Rédige un seul conseil synthétique, bienveillant, naturel et pratique en français (3-4 phrases max) à destination de son proche, en intégrant tous les éléments pertinents. Ne commence pas par "Bien sûr" ou une formule de politesse. Va droit au but.`;

        const completion = await groq.chat.completions.create({
            model     : 'openai/gpt-oss-20b',
            messages  : [{ role: 'user', content: prompt }],
            max_tokens: 400
        });
        const conseil = completion.choices[0]?.message?.content?.trim() || null;
        res.json({ success: true, conseil, moodRempli: true, moods: moodsCoches, phase, cycleInfo });

    } catch (err) {
        console.error('[SOCIAL] GET /conseil :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
