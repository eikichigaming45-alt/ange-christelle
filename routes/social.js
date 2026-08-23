// ============================================================
// routes/social.js
// Partages, messages privés, notifications, conseil cycle.
// Auth via JWT Bearer — sécurité gérée par Express.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/pool');
const webpush  = require('web-push');
const Groq     = require('groq-sdk');
const { authenticateToken } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.use(authenticateToken);

// ============================================================
// PARTAGES
// ============================================================

// ── GET /api/social/partages/miens ────────────────────────────
// Liste les partages que j'ai créés (ce que je partage).
router.get('/partages/miens', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT s.id, s.viewer_id, s.resource_type, s.active, s.created_at,
                   u.username, p.prenom, p.nom, p.photo
            FROM shares s
            JOIN users u ON u.id = s.viewer_id
            LEFT JOIN profiles p ON p.user_id = s.viewer_id
            WHERE s.owner_id = \$1
            ORDER BY s.created_at DESC
        `, [req.user.id]);
        res.json({ success: true, partages: rows });
    } catch (err) {
        console.error('[SOCIAL] GET /partages/miens :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/social/partages/recus ────────────────────────────
// Liste les partages que je reçois (ce que les autres partagent avec moi).
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

// ── POST /api/social/partages ─────────────────────────────────
// Crée un partage (owner → viewer, par catégorie).
router.post('/partages', async (req, res) => {
    const { viewer_id, resource_type } = req.body;
    const typesValides = ['cycle', 'rdv', 'taches', 'planning'];
    if (!viewer_id || !typesValides.includes(resource_type)) {
        return res.status(400).json({ success: false, message: 'Données invalides.' });
    }
    if (parseInt(viewer_id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Impossible de partager avec soi-même.' });
    }

    // Vérification : cycle uniquement pour les femmes
    if (resource_type === 'cycle') {
        const { rows } = await pool.query(
            'SELECT sexe FROM profiles WHERE user_id = \$1', [req.user.id]
        );
        if (rows[0]?.sexe !== 'femme') {
            return res.status(403).json({ success: false, message: 'Le partage cycle est réservé aux femmes.' });
        }
    }

    try {
        const { rows } = await pool.query(`
            INSERT INTO shares (owner_id, viewer_id, resource_type, active)
            VALUES (\$1, \$2, \$3, TRUE)
            ON CONFLICT (owner_id, viewer_id, resource_type) DO UPDATE SET active = TRUE
            RETURNING *
        `, [req.user.id, viewer_id, resource_type]);

        // Notification au viewer
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

// ── PATCH /api/social/partages/:id ───────────────────────────
// Active ou désactive un partage.
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

// ── DELETE /api/social/partages/:id ──────────────────────────
// Supprime définitivement un partage.
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
// COUCOU
// ============================================================

// ── POST /api/social/coucou/:userId ──────────────────────────
// Envoie un coucou à l'owner (message privé + notification + push).
router.post('/coucou/:userId', async (req, res) => {
    const receiverId = parseInt(req.params.userId);
    if (receiverId === req.user.id) {
        return res.status(400).json({ success: false, message: 'Impossible de s\'envoyer un coucou.' });
    }
    const content = "Coucou, tu n'as pas encore renseigné ton mood aujourd'hui, comment tu vas ? 💕";
    try {
        // Message privé
        const { rows } = await pool.query(`
            INSERT INTO private_messages (sender_id, receiver_id, content)
            VALUES (\$1, \$2, \$3)
            RETURNING id
        `, [req.user.id, receiverId, content]);

        // Notification
        await pool.query(`
            INSERT INTO notifications (user_id, type, ref_id)
            VALUES (\$1, 'coucou', \$2)
        `, [receiverId, rows[0].id]);

        // Push
        const sub = await pool.query(
            'SELECT subscription FROM push_subscriptions WHERE user_id = \$1', [receiverId]
        );
        if (sub.rows.length) {
            const senderProfil = await pool.query(
                'SELECT prenom, nom FROM profiles WHERE user_id = \$1', [req.user.id]
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

// ── GET /api/social/messages ──────────────────────────────────
// Liste tous les messages privés reçus et envoyés.
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

// ── PATCH /api/social/messages/:id/vu ────────────────────────
// Marque un message comme vu.
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

// ── GET /api/social/notifications ────────────────────────────
// Liste toutes les notifications non vues.
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

// ── PATCH /api/social/notifications/tout-vu ──────────────────
// Marque toutes les notifications comme vues.
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

// ── PATCH /api/social/notifications/:id/vu ───────────────────
// Marque une notification comme vue.
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

// ── GET /api/social/notifications/count ──────────────────────
// Retourne le nombre de notifications non vues (badge).
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

// ============================================================
// CONSEIL CYCLE (Groq)
// ============================================================

// ── GET /api/social/conseil/:ownerId ─────────────────────────
// Retourne le conseil du jour pour le viewer, basé sur le mood
// de l'owner. Vérifie que le partage cycle est actif.
router.get('/conseil/:ownerId', async (req, res) => {
    const ownerId = parseInt(req.params.ownerId);
    try {
        // Vérification partage actif
        const partage = await pool.query(`
            SELECT id FROM shares
            WHERE owner_id = \$1 AND viewer_id = \$2
              AND resource_type = 'cycle' AND active = TRUE
        `, [ownerId, req.user.id]);
        if (!partage.rows.length) {
            return res.status(403).json({ success: false, message: 'Partage cycle non actif.' });
        }

        // Mood du jour de l'owner
        const today   = new Date().toISOString().split('T')[0];
        const moodRes = await pool.query(
            'SELECT moods FROM cycle_mood WHERE user_id = \$1 AND date = \$2',
            [ownerId, today]
        );
        if (!moodRes.rows.length || !moodRes.rows[0].moods) {
            return res.json({ success: true, conseil: null, moodRempli: false });
        }

        const moodsCoches = moodRes.rows[0].moods.split(',').filter(Boolean);

        // Récupération phase du jour depuis le dernier cycle
        const cycleRes = await pool.query(
            'SELECT date_debut, duree_regles, duree_cycle FROM cycles WHERE user_id = \$1 ORDER BY date_debut DESC LIMIT 1',
            [ownerId]
        );
        let phase = 'luteale';
        if (cycleRes.rows.length) {
            const debut      = new Date(cycleRes.rows[0].date_debut);
            const dureeR     = cycleRes.rows[0].duree_regles || 5;
            const dureeC     = cycleRes.rows[0].duree_cycle  || 28;
            const now        = new Date();
            const jourCycle  = Math.floor((now - debut) / (1000 * 60 * 60 * 24)) + 1;
            const ovulation  = dureeC - 14;
            if (jourCycle <= dureeR)                                     phase = 'regles';
            else if (jourCycle < ovulation - 2)                          phase = 'folliculaire';
            else if (jourCycle >= ovulation - 2 && jourCycle <= ovulation + 1) phase = 'ovulation';
            else                                                          phase = 'luteale';
        }

        // Conseils individuels depuis cycle_advice
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

        // Synthèse Groq
        const prompt = `Tu es un assistant bienveillant. Une femme a coché ces humeurs aujourd'hui : ${moodsCoches.join(', ')}. 
Voici des conseils individuels sur comment se comporter avec elle : 
${conseilsTextes.join('\n')}
Rédige un seul conseil synthétique, bienveillant, naturel et pratique en français (3-4 phrases max) à destination de son proche, en intégrant tous les éléments pertinents. Ne commence pas par "Bien sûr" ou une formule de politesse. Va droit au but.`;

        const completion = await groq.chat.completions.create({
            model   : 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }],
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
