// ============================================================
// routes/feed.js
// Fil social : posts, likes, commentaires, follows, @mentions
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { envoyerPush }       = require('./push');
const multer                = require('multer');
const sharp                 = require('sharp');
const path                  = require('path');
const fs                    = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads/posts');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Utilitaire : sauvegarder une image sur disque ────────────
async function sauvegarderImage(buffer, userId) {
    const filename = `${userId}_${Date.now()}.webp`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await sharp(buffer).webp({ quality: 80 }).toFile(filepath);
    return `/uploads/posts/${filename}`;
}

// ── Utilitaire : supprimer une image du disque ───────────────
function supprimerImage(photo_url) {
    if (!photo_url) return;
    const filename = path.basename(photo_url);
    const filepath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
}

// ── Utilitaire : extraire et résoudre les @mentions ──────────
async function resoudreMentions(contenu, auteurId) {
    const matches = [...contenu.matchAll(/@([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ]*(?:\s[A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ]*)*)(?:\u00A0|\s{2,}|\s|$)/g)];
    if (!matches.length) return [];

    const mentions = new Set();
    for (const m of matches) {
        const token = m[1].trim();
        if (token.toLowerCase() === 'toutlemonde') continue;
        const parts = token.split(/\s+/);
        if (parts.length < 2) continue;

        for (let i = 1; i < parts.length; i++) {
            const prenom = parts.slice(0, i).join(' ');
            const nom    = parts.slice(i).join(' ');
            const { rows } = await pool.query(
                `SELECT user_id FROM profiles
                 WHERE LOWER(prenom) = LOWER(\\$1) AND LOWER(nom) = LOWER(\\$2)
                 LIMIT 1`,
                [prenom, nom]
            );
            if (rows.length && rows[0].user_id !== auteurId) {
                mentions.add(rows[0].user_id);
                break;
            }
        }
    }
    return [...mentions];
}

// ── Utilitaire : notifier @toutlemonde ───────────────────────
async function notifierToutLeMonde(auteurId, refId, type, prenomAuteur, nomAuteur) {
    const { rows } = await pool.query(
        'SELECT id FROM users WHERE id != \\$1',
        [auteurId]
    );
    for (const u of rows) {
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id)
             VALUES (\\$1, \\$2, \\$3, \\$4)
             ON CONFLICT DO NOTHING`,
            [u.id, type === 'post' ? 'mention_post' : 'mention_comment', refId, auteurId]
        );
        await envoyerPush(
            u.id,
            '📢 Annonce générale',
            `${prenomAuteur}${nomAuteur ? ' ' + nomAuteur : ''} a publié une annonce pour tout le monde`,
            `toutlemonde-${type}-${refId}`
        );
    }
}

// ── Utilitaire : notifier les @mentions ──────────────────────
async function notifierMentions(mentionIds, auteurId, refId, type, prenomAuteur, nomAuteur) {
    for (const targetId of mentionIds) {
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id)
             VALUES (\\$1, \\$2, \\$3, \\$4)
             ON CONFLICT DO NOTHING`,
            [targetId, type === 'post' ? 'mention_post' : 'mention_comment', refId, auteurId]
        );
        await envoyerPush(
            targetId,
            '🏷️ Tu as été mentionné(e)',
            `${prenomAuteur}${nomAuteur ? ' ' + nomAuteur : ''} t'a mentionné(e) dans un ${type === 'post' ? 'post' : 'commentaire'}`,
            `mention-${type}-${refId}`
        );
    }
}

// ── Utilitaire : récupérer prenom/nom de l'auteur connecté ───
async function getProfilAuteur(userId) {
    const { rows } = await pool.query(
        `SELECT prenom, nom FROM profiles WHERE user_id = \\$1`, [userId]
    );
    return {
        prenom: rows[0]?.prenom || 'Quelqu\'un',
        nom:    rows[0]?.nom    || ''
    };
}

// ── Utilitaire : détecter @toutlemonde dans le contenu ───────
function contientToutLeMonde(contenu) {
    return /@toutlemonde(?:\s|$)/i.test(contenu);
}

// ── GET /api/feed/users (autocomplete @mention) ──────────────
router.get('/users', authenticateToken, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [] });
    try {
        const { rows } = await pool.query(
            `SELECT u.id, pr.prenom, pr.nom, pr.photo AS avatar
             FROM users u
             LEFT JOIN profiles pr ON pr.user_id = u.id
             WHERE LOWER(pr.prenom) LIKE LOWER(\\$1)
                OR LOWER(pr.nom)    LIKE LOWER(\\$1)
                OR LOWER(CONCAT(pr.prenom, ' ', pr.nom)) LIKE LOWER(\\$1)
             ORDER BY pr.prenom, pr.nom
             LIMIT 8`,
            [`${q}%`]
        );
        res.json({ success: true, users: rows, isAdmin: req.user.role === 'admin' });
    } catch (e) {
        console.error('[FEED USERS SEARCH]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed ─────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const filter = req.query.filter;
    try {
        let query = `
            SELECT
                p.id, p.contenu, p.photo_url, p.created_at,
                p.mentions,
                CASE WHEN p.mentions IS NOT NULL AND array_length(p.mentions, 1) > 0 THEN (
                    SELECT json_agg(json_build_object('id', u2.id, 'prenom', pr2.prenom, 'nom', pr2.nom))
                    FROM unnest(p.mentions) AS mid
                    JOIN users u2 ON u2.id = mid
                    LEFT JOIN profiles pr2 ON pr2.user_id = u2.id
                ) ELSE NULL END AS mentions_data,
                pr.prenom, pr.nom, pr.photo AS avatar,
                u.username,
                u.id AS user_id,
                (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id)::int AS likes,
                (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)::int AS nb_comments,
                EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = \\$1) AS liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN profiles pr ON pr.user_id = p.user_id
        `;
        const params = [userId];
        if (filter === 'following') {
            query += ` WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = \\$1)`;
        }
        query += ` ORDER BY p.created_at DESC LIMIT 50`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, posts: rows });
    } catch (e) {
        console.error('[FEED GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed ────────────────────────────────────────────
router.post('/', authenticateToken, upload.single('photo'), async (req, res) => {
    const userId   = req.user.id;
    const contenu  = (req.body.contenu || '').trim();
    const photoB64 = req.body.photo || null;

    if (!contenu && !photoB64 && !req.file) {
        return res.status(400).json({ success: false, message: 'Post vide.' });
    }
    try {
        let photo_url = null;
        if (req.file) {
            photo_url = await sauvegarderImage(req.file.buffer, userId);
        } else if (photoB64) {
            const buffer = Buffer.from(photoB64, 'base64');
            photo_url = await sauvegarderImage(buffer, userId);
        }

        const mentionIds = contenu ? await resoudreMentions(contenu, userId) : [];

        const { rows } = await pool.query(
            `INSERT INTO posts (user_id, contenu, photo_url, mentions)
             VALUES (\\$1, \\$2, \\$3, \\$4)
             RETURNING id, contenu, photo_url, created_at, mentions`,
            [userId, contenu || null, photo_url, mentionIds]
        );
        const post = rows[0];
        const { prenom, nom } = await getProfilAuteur(userId);

        if (mentionIds.length) {
            await notifierMentions(mentionIds, userId, post.id, 'post', prenom, nom);
        }
        if (contenu && contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, post.id, 'post', prenom, nom);
        }

        res.json({ success: true, post });
    } catch (e) {
        console.error('[FEED POST]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/following ───────────────────────────────────
router.get('/following', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query(
            `SELECT following_id FROM follows WHERE follower_id = \\$1`, [userId]
        );
        res.json({ success: true, following: rows.map(r => r.following_id) });
    } catch (e) {
        console.error('[FEED FOLLOWING]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/follow/:id ─────────────────────────────────
router.post('/follow/:id', authenticateToken, async (req, res) => {
    const followerId  = req.user.id;
    const followingId = parseInt(req.params.id);
    if (followerId === followingId) {
        return res.status(400).json({ success: false, message: 'Impossible de se suivre soi-même.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id FROM follows WHERE follower_id = \\$1 AND following_id = \\$2`,
            [followerId, followingId]
        );
        if (rows.length) {
            await pool.query(
                `DELETE FROM follows WHERE follower_id = \\$1 AND following_id = \\$2`,
                [followerId, followingId]
            );
            return res.json({ success: true, following: false });
        }

        await pool.query(
            `INSERT INTO follows (follower_id, following_id) VALUES (\\$1, \\$2)`,
            [followerId, followingId]
        );
        const { prenom, nom } = await getProfilAuteur(followerId);
        await pool.query(
            `INSERT INTO notifications (user_id, type, ref_id, sender_id)
             VALUES (\\$1, 'follow', \\$2, \\$3)`,
            [followingId, followerId, followerId]
        );
        await envoyerPush(
            followingId,
            '👤 Nouvel abonné',
            `${prenom}${nom ? ' ' + nom : ''} a commencé à te suivre`,
            `follow-${followerId}`
        );
        res.json({ success: true, following: true });
    } catch (e) {
        console.error('[FEED FOLLOW]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/comments/:id ────────────────────────────────
router.put('/comments/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    if (!contenu) return res.status(400).json({ success: false, message: 'Contenu vide.' });
    try {
        const { rows } = await pool.query(
            `SELECT user_id FROM post_comments WHERE id = \\$1`, [commentId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        const mentionIds = await resoudreMentions(contenu, userId);

        await pool.query(
            `UPDATE post_comments SET contenu = \\$1, mentions = \\$2 WHERE id = \\$3`,
            [contenu, mentionIds, commentId]
        );

        const { prenom, nom } = await getProfilAuteur(userId);

        if (mentionIds.length) {
            await notifierMentions(mentionIds, userId, commentId, 'comment', prenom, nom);
        }
        if (contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, commentId, 'comment', prenom, nom);
        }

        res.json({ success: true });
    } catch (e) {
        console.error('[FEED COMMENT PUT]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/feed/comments/:id ────────────────────────────
router.delete('/comments/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT user_id FROM post_comments WHERE id = \\$1`, [commentId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        await pool.query(`DELETE FROM post_comments WHERE id = \\$1`, [commentId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED COMMENT DELETE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/comments/:id/like ─────────────────────────
router.post('/comments/:id/like', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT id FROM comment_likes WHERE comment_id = \\$1 AND user_id = \\$2`,
            [commentId, userId]
        );
        if (rows.length) {
            await pool.query(
                `DELETE FROM comment_likes WHERE comment_id = \\$1 AND user_id = \\$2`,
                [commentId, userId]
            );
            return res.json({ success: true, liked: false });
        }
        await pool.query(
            `INSERT INTO comment_likes (comment_id, user_id) VALUES (\\$1, \\$2)`,
            [commentId, userId]
        );
        res.json({ success: true, liked: true });
    } catch (e) {
        console.error('[COMMENT LIKE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/:id/like ───────────────────────────────────
router.post('/:id/like', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT id FROM post_likes WHERE post_id = \\$1 AND user_id = \\$2`,
            [postId, userId]
        );
        if (rows.length) {
            await pool.query(
                `DELETE FROM post_likes WHERE post_id = \\$1 AND user_id = \\$2`,
                [postId, userId]
            );
            return res.json({ success: true, liked: false });
        }

        await pool.query(
            `INSERT INTO post_likes (post_id, user_id) VALUES (\\$1, \\$2)`,
            [postId, userId]
        );
        const { rows: postRows } = await pool.query(
            `SELECT user_id FROM posts WHERE id = \\$1`, [postId]
        );
        const ownerId = postRows[0]?.user_id;
        if (ownerId && ownerId !== userId) {
            const { prenom, nom } = await getProfilAuteur(userId);
            await pool.query(
                `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                 VALUES (\\$1, 'like', \\$2, \\$3)`,
                [ownerId, postId, userId]
            );
            await envoyerPush(
                ownerId,
                '❤️ Nouveau like',
                `${prenom}${nom ? ' ' + nom : ''} a aimé ta publication`,
                `like-${postId}-${userId}`
            );
        }
        res.json({ success: true, liked: true });
    } catch (e) {
        console.error('[FEED LIKE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/:id/likes ───────────────────────────────────
router.get('/:id/likes', authenticateToken, async (req, res) => {
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`
            SELECT pr.prenom, pr.nom, pr.photo AS avatar, u.username
            FROM post_likes l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN profiles pr ON pr.user_id = l.user_id
            WHERE l.post_id = \\$1
            ORDER BY l.id ASC
        `, [postId]);
        res.json({ success: true, likers: rows });
    } catch (e) {
        console.error('[FEED LIKES GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/:id/comments ────────────────────────────────
router.get('/:id/comments', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`
            SELECT c.id, c.contenu, c.created_at, c.parent_id,
                   c.mentions,
                   CASE WHEN c.mentions IS NOT NULL AND array_length(c.mentions, 1) > 0 THEN (
                       SELECT json_agg(json_build_object('id', u2.id, 'prenom', pr2.prenom, 'nom', pr2.nom))
                       FROM unnest(c.mentions) AS mid
                       JOIN users u2 ON u2.id = mid
                       LEFT JOIN profiles pr2 ON pr2.user_id = u2.id
                   ) ELSE NULL END AS mentions_data,
                   pr.prenom, pr.nom, pr.photo AS avatar,
                   u.username, u.id AS user_id,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)::int AS likes,
                   EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = \\$2) AS liked
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN profiles pr ON pr.user_id = c.user_id
            WHERE c.post_id = \\$1
            ORDER BY COALESCE(c.parent_id, c.id), c.id ASC
        `, [postId, userId]);
        res.json({ success: true, comments: rows });
    } catch (e) {
        console.error('[FEED COMMENTS GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/:id/comments ───────────────────────────────
router.post('/:id/comments', authenticateToken, async (req, res) => {
    const userId   = req.user.id;
    const postId   = parseInt(req.params.id);
    const contenu  = (req.body.contenu || '').trim();
    const parentId = req.body.parent_id ? parseInt(req.body.parent_id) : null;
    if (!contenu) return res.status(400).json({ success: false, message: 'Commentaire vide.' });

    try {
        const mentionIds = await resoudreMentions(contenu, userId);

        const { rows } = await pool.query(
            `INSERT INTO post_comments (post_id, user_id, contenu, mentions, parent_id)
             VALUES (\\$1, \\$2, \\$3, \\$4, \\$5)
             RETURNING id, contenu, created_at, mentions, parent_id`,
            [postId, userId, contenu, mentionIds, parentId]
        );
        const comment = rows[0];
        const { prenom, nom } = await getProfilAuteur(userId);

        const { rows: postRows } = await pool.query(
            `SELECT user_id FROM posts WHERE id = \\$1`, [postId]
        );
        const ownerId = postRows[0]?.user_id;
        if (ownerId && ownerId !== userId) {
            await pool.query(
                `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                 VALUES (\\$1, 'comment', \\$2, \\$3)`,
                [ownerId, comment.id, userId]
            );
            await envoyerPush(
                ownerId,
                '💬 Nouveau commentaire',
                `${prenom}${nom ? ' ' + nom : ''} a commenté ta publication`,
                `comment-${comment.id}`
            );
        }

        if (parentId) {
            const { rows: parentRows } = await pool.query(
                `SELECT user_id FROM post_comments WHERE id = \\$1`, [parentId]
            );
            const parentAuteurId = parentRows[0]?.user_id;
            if (parentAuteurId && parentAuteurId !== userId && parentAuteurId !== ownerId) {
                await pool.query(
                    `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                     VALUES (\\$1, 'reply', \\$2, \\$3)`,
                    [parentAuteurId, comment.id, userId]
                );
                await envoyerPush(
                    parentAuteurId,
                    '↩️ Réponse à ton commentaire',
                    `${prenom}${nom ? ' ' + nom : ''} a répondu à ton commentaire`,
                    `reply-${comment.id}`
                );
            }
        }

        const exclus = [ownerId, parentId ? (await pool.query(`SELECT user_id FROM post_comments WHERE id = \\$1`, [parentId])).rows[0]?.user_id : null].filter(Boolean);
        const mentionsFiltered = mentionIds.filter(id => !exclus.includes(id));
        if (mentionsFiltered.length) {
            await notifierMentions(mentionsFiltered, userId, comment.id, 'comment', prenom, nom);
        }
        if (contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, comment.id, 'comment', prenom, nom);
        }

        res.json({ success: true, comment });
    } catch (e) {
        console.error('[FEED COMMENT POST]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/:id ─────────────────────────────────────────
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
    const userId    = req.user.id;
    const postId    = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    const photoB64  = req.body.photo || null;
    const suppPhoto = req.body.supprimer_photo === true || req.body.supprimer_photo === 'true';

    try {
        const { rows } = await pool.query(
            `SELECT user_id, photo_url FROM posts WHERE id = \\$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        let photo_url = post.photo_url;
        if ((suppPhoto || req.file || photoB64) && post.photo_url) {
            supprimerImage(post.photo_url);
            photo_url = null;
        }
        if (req.file) {
            photo_url = await sauvegarderImage(req.file.buffer, userId);
        } else if (photoB64) {
            const buffer = Buffer.from(photoB64, 'base64');
            photo_url = await sauvegarderImage(buffer, userId);
        }

        const mentionIds = contenu ? await resoudreMentions(contenu, userId) : [];

        await pool.query(
            `UPDATE posts SET contenu = \\$1, photo_url = \\$2, mentions = \\$3 WHERE id = \\$4`,
            [contenu || null, photo_url, mentionIds, postId]
        );

        const { prenom, nom } = await getProfilAuteur(userId);

        if (mentionIds.length) {
            await notifierMentions(mentionIds, userId, postId, 'post', prenom, nom);
        }
        if (contenu && contientToutLeMonde(contenu) && req.user.role === 'admin') {
            await notifierToutLeMonde(userId, postId, 'post', prenom, nom);
        }

        res.json({ success: true, photo_url });
    } catch (e) {
        console.error('[FEED PUT]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/feed/:id ──────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(
            `SELECT user_id, photo_url FROM posts WHERE id = \\$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        supprimerImage(post.photo_url);
        await pool.query(`DELETE FROM posts WHERE id = \\$1`, [postId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED DELETE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
