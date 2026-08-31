// ============================================================
// routes/tchat.js
// Tchat privé — historique, envoi, lu, conversations, badge.
// Socket.io géré dans server.js — ce fichier = REST pur.
// ============================================================

const express        = require('express');
const router         = express.Router();
const { pool }       = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { envoyerPush } = require('./push');

// ── GET /api/tchat/conversations ──────────────────────────────
// Liste toutes les conversations de l'utilisateur connecté,
// avec le dernier message, le nombre de non-lus et le profil
// de l'interlocuteur.
router.get('/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT
                u.id                                      AS interlocuteur_id,
                u.username,
                p.prenom,
                p.nom,
                p.photo,
                last_msg.content                          AS dernier_message,
                last_msg.created_at                       AS dernier_message_at,
                last_msg.sender_id                        AS dernier_sender_id,
                COUNT(pm_unlu.id)::int                    AS non_lus
            FROM (
                SELECT DISTINCT
                    CASE WHEN sender_id = \$1 THEN receiver_id ELSE sender_id END AS other_id
                FROM private_messages
                WHERE sender_id = \$1 OR receiver_id = \$1
            ) conv
            JOIN users u    ON u.id = conv.other_id
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT content, created_at, sender_id
                FROM private_messages
                WHERE (sender_id = \$1 AND receiver_id = conv.other_id)
                   OR (sender_id = conv.other_id AND receiver_id = \$1)
                ORDER BY created_at DESC
                LIMIT 1
            ) last_msg ON TRUE
            LEFT JOIN private_messages pm_unlu
                ON pm_unlu.sender_id   = conv.other_id
               AND pm_unlu.receiver_id = \$1
               AND pm_unlu.seen        = FALSE
            GROUP BY
                u.id, u.username, p.prenom, p.nom, p.photo,
                last_msg.content, last_msg.created_at, last_msg.sender_id
            ORDER BY last_msg.created_at DESC NULLS LAST
        `, [userId]);

        res.json({ success: true, conversations: rows });
    } catch (err) {
        console.error('[TCHAT] GET /conversations :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/messages/:interlocuteurId ──────────────────
// Historique paginé avec un interlocuteur.
// Query param : ?avant=<id_message> pour pagination infinie vers
// le haut (charger plus anciens). Limite 40 messages par page.
router.get('/messages/:interlocuteurId', authenticateToken, async (req, res) => {
    const userId         = req.user.id;
    const interlocuteur  = parseInt(req.params.interlocuteurId, 10);
    const avant          = req.query.avant ? parseInt(req.query.avant, 10) : null;

    if (!interlocuteur || isNaN(interlocuteur)) {
        return res.status(400).json({ success: false, message: 'Interlocuteur invalide.' });
    }

    try {
        const params = [userId, interlocuteur];
        let filtrePagination = '';
        if (avant) {
            params.push(avant);
            filtrePagination = `AND pm.id < $${params.length}`;
        }

        const { rows } = await pool.query(`
            SELECT
                pm.id,
                pm.sender_id,
                pm.receiver_id,
                pm.content,
                pm.seen,
                pm.created_at,
                u.username       AS sender_username,
                p.prenom         AS sender_prenom,
                p.photo          AS sender_photo
            FROM private_messages pm
            JOIN users u    ON u.id = pm.sender_id
            LEFT JOIN profiles p ON p.user_id = pm.sender_id
            WHERE (
                (pm.sender_id = \$1 AND pm.receiver_id = \$2)
                OR
                (pm.sender_id = \$2 AND pm.receiver_id = \$1)
            )
            ${filtrePagination}
            ORDER BY pm.created_at DESC
            LIMIT 40
        `, params);

        // On renvoie du plus ancien au plus récent pour l'affichage
        res.json({ success: true, messages: rows.reverse() });
    } catch (err) {
        console.error('[TCHAT] GET /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages ──────────────────────────────────
// Envoie un message. Déclenche une push notif "coucou" si le
// destinataire n'a pas de socket actif (géré côté server.js via
// le flag tchatUsersConnected exposé sur app).
// Pour la v1.59 le flag est simplement absent → push systématique
// si abonnement existe. Optimisation socket v1.60 possible.
router.post('/messages', authenticateToken, async (req, res) => {
    const senderId  = req.user.id;
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content?.trim()) {
        return res.status(400).json({ success: false, message: 'Destinataire et message requis.' });
    }

    const receiverId = parseInt(receiver_id, 10);
    if (isNaN(receiverId) || receiverId === senderId) {
        return res.status(400).json({ success: false, message: 'Destinataire invalide.' });
    }

    const texte = content.trim().substring(0, 2000);

    try {
        // Vérifier que le destinataire existe
        const { rows: destRows } = await pool.query(
            `SELECT id FROM users WHERE id = \$1`,
            [receiverId]
        );
        if (!destRows.length) {
            return res.status(404).json({ success: false, message: 'Destinataire introuvable.' });
        }

        // Insérer le message
        const { rows } = await pool.query(`
            INSERT INTO private_messages (sender_id, receiver_id, content, seen, created_at)
            VALUES (\$1, \$2, \$3, FALSE, NOW())
            RETURNING id, sender_id, receiver_id, content, seen, created_at
        `, [senderId, receiverId, texte]);

        const message = rows[0];

        // Récupérer le profil de l'expéditeur pour la réponse Socket.io
        const { rows: profRows } = await pool.query(`
            SELECT u.username, p.prenom, p.photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = \$1
        `, [senderId]);

        const profil = profRows[0] || {};

        const messageComplet = {
            ...message,
            sender_username : profil.username,
            sender_prenom   : profil.prenom,
            sender_photo    : profil.photo
        };

        // Émettre via Socket.io si disponible (injecté depuis server.js)
        const io = req.app.get('io');
        if (io) {
            const room = _roomName(senderId, receiverId);
            io.to(room).emit('tchat:message', messageComplet);
        }

        // Push notif "coucou" — sera rebranché v1.59
        // On notifie le destinataire s'il n'est pas dans la room Socket.io
        const connectedUsers = req.app.get('tchatConnectedUsers') || new Set();
        if (!connectedUsers.has(receiverId)) {
            const { rows: senderProfil } = await pool.query(`
                SELECT COALESCE(p.prenom, u.username) AS nom
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.id = \$1
            `, [senderId]);
            const nomExpediteur = senderProfil[0]?.nom || 'Quelqu\'un';
            await envoyerPush(
                receiverId,
                `💬 ${nomExpediteur}`,
                texte.length > 60 ? texte.substring(0, 57) + '…' : texte,
                'coucou',
                '/?onglet=accueil'
            );
        }

        res.json({ success: true, message: messageComplet });
    } catch (err) {
        console.error('[TCHAT] POST /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages/lus ─────────────────────────────
// Marque tous les messages d'un interlocuteur comme lus.
router.post('/messages/lus', authenticateToken, async (req, res) => {
    const userId        = req.user.id;
    const { interlocuteur_id } = req.body;

    if (!interlocuteur_id) {
        return res.status(400).json({ success: false, message: 'interlocuteur_id requis.' });
    }

    try {
        await pool.query(`
            UPDATE private_messages
            SET seen = TRUE
            WHERE receiver_id = \$1
              AND sender_id   = \$2
              AND seen        = FALSE
        `, [userId, parseInt(interlocuteur_id, 10)]);

        // Notifier l'expéditeur que ses messages sont lus (Socket.io)
        const io = req.app.get('io');
        if (io) {
            const room = _roomName(userId, parseInt(interlocuteur_id, 10));
            io.to(room).emit('tchat:lu', { par: userId, interlocuteur: parseInt(interlocuteur_id, 10) });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] POST /messages/lus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/non-lus ────────────────────────────────────
// Nombre total de messages non lus — pour le badge bulle tchat.
router.get('/non-lus', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM private_messages
            WHERE receiver_id = \$1 AND seen = FALSE
        `, [userId]);

        res.json({ success: true, total: rows[0].total });
    } catch (err) {
        console.error('[TCHAT] GET /non-lus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/users ──────────────────────────────────────
// Liste des utilisateurs disponibles pour démarrer une conv.
// Exclut l'utilisateur connecté.
router.get('/users', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, p.prenom, p.nom, p.photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id != \$1
            ORDER BY COALESCE(p.prenom, u.username) ASC
        `, [userId]);

        res.json({ success: true, users: rows });
    } catch (err) {
        console.error('[TCHAT] GET /users :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── Utilitaire interne ────────────────────────────────────────
function _roomName(u1, u2) {
    return `conv_${Math.min(u1, u2)}_${Math.max(u1, u2)}`;
}

module.exports = router;
