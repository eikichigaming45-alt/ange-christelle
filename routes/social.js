// ============================================================
// routes/social.js
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const webpush  = require('web-push');
const Groq     = require('groq-sdk');
const { authenticateToken } = require('../middleware/auth');

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
              AND u.username ILIKE \$2
            ORDER BY u.username ASC
            LIMIT 20
        `, [req.user.id, `${q}%`]);
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
    const typesValides = ['cycle', 'rdv', 'taches', 'planning'];
    if (!viewer_id || !typesValides.includes(resource_type)) {
        return res.status(400).json({ success: false, message: 'Données invalides.' });
    }
    if (parseInt(viewer_id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Impossible de partager avec soi-même.' });
    }
    if (resource_type === 'cycle') {
        const { rows } = await pool.query(
            'SELECT sexe FROM profiles WHERE user_id = \$1', [req.user.id]
        );
        const sexe = rows[0]?.sexe ?? null;
        if (sexe !== 'femme' && sexe !== 'intersexe') {
            return res.status(403).json({
                success: false,
                message: 'Le partage du cycle est réservé aux femmes et aux personnes intersexes.'
            });
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
            INSERT INTO notifications (user_id, type, ref_id)
            VALUES (\$1, 'share_request', \$2)
        `, [viewer_id, rows[0].id]);
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
// DONNÉES PARTAGÉES — rdv, taches, planning
// ============================================================

router.get('/data/:ownerId/:type', async (req, res) => {
    const ownerId      = parseInt(req.params.ownerId);
    const type         = req.params.type;
    const typesValides = ['rdv', 'taches', 'planning'];

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

        const today = new Date().toISOString().split('T')[0];
        let data    = [];

        if (type === 'rdv') {
            const { rows } = await pool.query(`
                SELECT id, titre, date_rdv, praticien, lieu, type_rdv
                FROM rendezvous
                WHERE user_id = \$1 AND date_rdv >= NOW()
                ORDER BY date_rdv ASC
                LIMIT 5
            `, [ownerId]);
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

        if (type === 'planning') {
            const { rows } = await pool.query(`
                SELECT id, categorie, libelle_personnalise, heure_debut, heure_fin, employeur
                FROM planning
                WHERE user_id = \$1
                  AND (
                    (date_fin IS NULL AND COALESCE(date_debut, date) = \$2)
                    OR
                    (date_fin IS NOT NULL AND date_debut <= \$2 AND date_fin >= \$2)
                  )
                ORDER BY heure_debut ASC NULLS LAST
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
            INSERT INTO notifications (user_id, type, ref_id)
            VALUES (\$1, 'coucou', \$2)
        `, [receiverId, rows[0].id]);
        const sub = await pool.query(
            'SELECT subscription FROM push_subscriptions WHERE user_id = \$1', [receiverId]
        );
        if (sub.rows.length) {
            const senderProfil = await pool.query(
                'SELECT prenom FROM profiles WHERE user_id = \$1', [req.user.id]
            );
            const prenom = senderProfil.rows[0]?.prenom || 'Quelqu\'un';
            try {
                await webpush.sendNotification(
                    JSON.parse(sub.rows[0].subscription),
                    JSON.stringify({
                        titre: `${prenom} t'envoie un coucou`,
                        corps: content,
                        tag  : `coucou-${rows[0].id}`,
                        url  : '/'
                    })
                );
            } catch (pushErr) {
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    await pool.query('DELETE FROM push_subscriptions WHERE user_id = \$1', [receiverId]);
                }
            }
        }
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
            SELECT id, type, ref_id, seen, created_at
            FROM notifications
            WHERE user_id = \$1
            ORDER BY created_at DESC
            LIMIT 50
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
        if (!moodRes.rows.length || !moodRes.rows[0].moods) {
            return res.json({ success: true, conseil: null, moodRempli: false });
        }
        const moodsCoches = moodRes.rows[0].moods.split(',').filter(Boolean);
        const cycleRes = await pool.query(
            'SELECT date_debut, duree_regles, duree_cycle FROM cycles WHERE user_id = \$1 ORDER BY date_debut DESC LIMIT 1',
            [ownerId]
        );
        let phase = 'luteale';
        if (cycleRes.rows.length) {
            const debut     = new Date(cycleRes.rows[0].date_debut);
            const dureeR    = cycleRes.rows[0].duree_regles || 5;
            const dureeC    = cycleRes.rows[0].duree_cycle  || 28;
            const now       = new Date();
            const jourCycle = Math.floor((now - debut) / (1000 * 60 * 60 * 24)) + 1;
            const ovulation = dureeC - 14;
            if (jourCycle <= dureeR)                                           phase = 'regles';
            else if (jourCycle < ovulation - 2)                                phase = 'folliculaire';
            else if (jourCycle >= ovulation - 2 && jourCycle <= ovulation + 1) phase = 'ovulation';
            else                                                                phase = 'luteale';
        }
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
            return res.json({ success: true, conseil: conseilsTextes[0] || null, moodRempli: true, moods: moodsCoches, phase });
        }

        const prompt = `Tu es un assistant bienveillant. Une femme a coché ces humeurs aujourd'hui : ${moodsCoches.join(', ')}. 
Voici des conseils individuels sur comment se comporter avec elle : 
${conseilsTextes.join('\n')}
Rédige un seul conseil synthétique, bienveillant, naturel et pratique en français (3-4 phrases max) à destination de son proche, en intégrant tous les éléments pertinents. Ne commence pas par "Bien sûr" ou une formule de politesse. Va droit au but.`;

        const completion = await groq.chat.completions.create({
            model     : 'llama3-8b-8192',
            messages  : [{ role: 'user', content: prompt }],
            max_tokens: 200
        });
        const conseil = completion.choices[0]?.message?.content?.trim() || null;
        res.json({ success: true, conseil, moodRempli: true, moods: moodsCoches, phase });
    } catch (err) {
        console.error('[SOCIAL] GET /conseil :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
