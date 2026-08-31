// ============================================================
// routes/tchat.js
// Tchat privé — historique, envoi, lu, conversations, badge,
// édition, suppression, réponse, purge 90j.
// Socket.io géré dans server.js — ce fichier = REST pur.
// ============================================================

const express         = require('express');
const router          = express.Router();
const { pool }        = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { envoyerPush } = require('./push');

// ── GET /api/tchat/conversations ──────────────────────────────
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
                WHERE (sender_id = \$1 OR receiver_id = \$1)
                  AND NOT (\$1 = ANY(COALESCE(deleted_for, '{}')))
            ) conv
            JOIN users u ON u.id = conv.other_id
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT content, created_at, sender_id
                FROM private_messages
                WHERE (
                    (sender_id = \$1 AND receiver_id = conv.other_id)
                    OR (sender_id = conv.other_id AND receiver_id = \$1)
                )
                AND NOT (\$1 = ANY(COALESCE(deleted_for, '{}')))
                ORDER BY created_at DESC
                LIMIT 1
            ) last_msg ON TRUE
            LEFT JOIN private_messages pm_unlu
                ON pm_unlu.sender_id   = conv.other_id
               AND pm_unlu.receiver_id = \$1
               AND pm_unlu.seen        = FALSE
               AND NOT (\$1 = ANY(COALESCE(pm_unlu.deleted_for, '{}')))
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

// ── DELETE /api/tchat/conversations/:interlocuteurId ──────────
// Supprime la conversation pour soi uniquement.
router.delete('/conversations/:interlocuteurId', authenticateToken, async (req, res) => {
    const userId        = req.user.id;
    const interlocuteur = parseInt(req.params.interlocuteurId, 10);
    if (isNaN(interlocuteur)) {
        return res.status(400).json({ success: false, message: 'Interlocuteur invalide.' });
    }
    try {
        await pool.query(`
            UPDATE private_messages
            SET deleted_for = array_append(
                COALESCE(deleted_for, '{}'),
                \$1
            )
            WHERE (sender_id = \$1 AND receiver_id = \$2)
               OR (sender_id = \$2 AND receiver_id = \$1)
               AND NOT (\$1 = ANY(COALESCE(deleted_for, '{}')))
        `, [userId, interlocuteur]);

        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] DELETE /conversations :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/messages/:interlocuteurId ──────────────────
router.get('/messages/:interlocuteurId', authenticateToken, async (req, res) => {
    const userId        = req.user.id;
    const interlocuteur = parseInt(req.params.interlocuteurId, 10);
    const avant         = req.query.avant ? parseInt(req.query.avant, 10) : null;

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
                pm.edited_at,
                pm.reply_to_id,
                pm.deleted_for,
                u.username       AS sender_username,
                p.prenom         AS sender_prenom,
                p.photo          AS sender_photo,
                reply.content    AS reply_content,
                reply.sender_id  AS reply_sender_id,
                rp.prenom        AS reply_sender_prenom,
                ru.username      AS reply_sender_username
            FROM private_messages pm
            JOIN users u ON u.id = pm.sender_id
            LEFT JOIN profiles p ON p.user_id = pm.sender_id
            LEFT JOIN private_messages reply ON reply.id = pm.reply_to_id
            LEFT JOIN users ru ON ru.id = reply.sender_id
            LEFT JOIN profiles rp ON rp.user_id = reply.sender_id
            WHERE (
                (pm.sender_id = \$1 AND pm.receiver_id = \$2)
                OR
                (pm.sender_id = \$2 AND pm.receiver_id = \$1)
            )
            AND NOT (\$1 = ANY(COALESCE(pm.deleted_for, '{}')))
            ${filtrePagination}
            ORDER BY pm.created_at DESC
            LIMIT 40
        `, params);

        res.json({ success: true, messages: rows.reverse() });
    } catch (err) {
        console.error('[TCHAT] GET /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages ──────────────────────────────────
router.post('/messages', authenticateToken, async (req, res) => {
    const senderId               = req.user.id;
    const { receiver_id, content, reply_to_id } = req.body;

    if (!receiver_id || !content?.trim()) {
        return res.status(400).json({ success: false, message: 'Destinataire et message requis.' });
    }

    const receiverId = parseInt(receiver_id, 10);
    if (isNaN(receiverId) || receiverId === senderId) {
        return res.status(400).json({ success: false, message: 'Destinataire invalide.' });
    }

    const texte      = content.trim().substring(0, 2000);
    const replyToId  = reply_to_id ? parseInt(reply_to_id, 10) : null;

    try {
        const { rows: destRows } = await pool.query(
            `SELECT id FROM users WHERE id = \$1`, [receiverId]
        );
        if (!destRows.length) {
            return res.status(404).json({ success: false, message: 'Destinataire introuvable.' });
        }

        const { rows } = await pool.query(`
            INSERT INTO private_messages
                (sender_id, receiver_id, content, seen, created_at, reply_to_id)
            VALUES (\$1, \$2, \$3, FALSE, NOW(), \$4)
            RETURNING id, sender_id, receiver_id, content, seen, created_at,
                      edited_at, reply_to_id, deleted_for
        `, [senderId, receiverId, texte, replyToId]);

        const message = rows[0];

        const { rows: profRows } = await pool.query(`
            SELECT u.username, p.prenom, p.photo
            FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = \$1
        `, [senderId]);

        const profil = profRows[0] || {};

        // Récupérer le message cité si reply
        let replyData = null;
        if (replyToId) {
            const { rows: replyRows } = await pool.query(`
                SELECT pm.content, pm.sender_id,
                       COALESCE(p.prenom, u.username) AS sender_nom
                FROM private_messages pm
                JOIN users u ON u.id = pm.sender_id
                LEFT JOIN profiles p ON p.user_id = pm.sender_id
                WHERE pm.id = \$1
            `, [replyToId]);
            if (replyRows.length) replyData = replyRows[0];
        }

        const messageComplet = {
            ...message,
            sender_username     : profil.username,
            sender_prenom       : profil.prenom,
            sender_photo        : profil.photo,
            reply_content       : replyData?.content       || null,
            reply_sender_id     : replyData?.sender_id     || null,
            reply_sender_prenom : replyData?.sender_nom    || null
        };

        const io = req.app.get('io');
        if (io) {
            const room = _roomName(senderId, receiverId);
            io.to(room).emit('tchat:message', messageComplet);
        }

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

// ── PATCH /api/tchat/messages/:id ────────────────────────────
// Modifier son propre message.
router.patch('/messages/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const msgId     = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (!content?.trim()) {
        return res.status(400).json({ success: false, message: 'Contenu requis.' });
    }
    if (isNaN(msgId)) {
        return res.status(400).json({ success: false, message: 'Message invalide.' });
    }

    const texte = content.trim().substring(0, 2000);

    try {
        const { rows } = await pool.query(`
            UPDATE private_messages
            SET content  = \$1,
                edited_at = NOW()
            WHERE id = \$2
              AND sender_id = \$3
            RETURNING id, sender_id, receiver_id, content, seen,
                      created_at, edited_at, reply_to_id
        `, [texte, msgId, userId]);

        if (!rows.length) {
            return res.status(403).json({ success: false, message: 'Message introuvable ou non autorisé.' });
        }

        const msg = rows[0];

        // Notifier via Socket.io
        const io = req.app.get('io');
        if (io) {
            const room = _roomName(msg.sender_id, msg.receiver_id);
            io.to(room).emit('tchat:modifie', msg);
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        console.error('[TCHAT] PATCH /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/tchat/messages/:id ───────────────────────────
// Supprimer un message pour soi uniquement.
router.delete('/messages/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const msgId  = parseInt(req.params.id, 10);

    if (isNaN(msgId)) {
        return res.status(400).json({ success: false, message: 'Message invalide.' });
    }

    try {
        // Vérifier que le message appartient à la conv de cet user
        const { rows: check } = await pool.query(`
            SELECT id, sender_id, receiver_id FROM private_messages
            WHERE id = \$1
              AND (sender_id = \$2 OR receiver_id = \$2)
        `, [msgId, userId]);

        if (!check.length) {
            return res.status(403).json({ success: false, message: 'Message introuvable ou non autorisé.' });
        }

        await pool.query(`
            UPDATE private_messages
            SET deleted_for = array_append(
                COALESCE(deleted_for, '{}'),
                \$1
            )
            WHERE id = \$2
              AND NOT (\$1 = ANY(COALESCE(deleted_for, '{}')))
        `, [userId, msgId]);

        // Notifier via Socket.io
        const io = req.app.get('io');
        if (io) {
            const msg = check[0];
            const room = _roomName(msg.sender_id, msg.receiver_id);
            io.to(room).emit('tchat:supprime', { id: msgId, par: userId });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[TCHAT] DELETE /messages :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/tchat/messages/lus ─────────────────────────────
router.post('/messages/lus', authenticateToken, async (req, res) => {
    const userId           = req.user.id;
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
router.get('/non-lus', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS total
            FROM private_messages
            WHERE receiver_id = \$1
              AND seen         = FALSE
              AND NOT (\$1 = ANY(COALESCE(deleted_for, '{}')))
        `, [userId]);

        res.json({ success: true, total: rows[0].total });
    } catch (err) {
        console.error('[TCHAT] GET /non-lus :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/tchat/users ──────────────────────────────────────
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

// ── POST /api/tchat/purge ─────────────────────────────────────
// Purge manuelle + appelée au démarrage depuis server.js
async function purgerMessages() {
    try {
        const { rowCount } = await pool.query(`
            DELETE FROM private_messages
            WHERE created_at < NOW() - INTERVAL '90 days'
        `);
        if (rowCount > 0) {
            console.log(`[TCHAT] Purge 90j — ${rowCount} message(s) supprimé(s)`);
        }
    } catch (err) {
        console.error('[TCHAT] Purge :', err.message);
    }
}

// ── Utilitaire interne ────────────────────────────────────────
function _roomName(u1, u2) {
    return `conv_${Math.min(u1, u2)}_${Math.max(u1, u2)}`;
}

module.exports = { router, purgerMessages };
