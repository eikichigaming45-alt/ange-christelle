// ============================================================
// routes/feed.js
// Fil social : posts, likes, commentaires, follows
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { createClient }      = require('@supabase/supabase-js');
const { envoyerPush }       = require('./push');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ── GET /api/feed ─────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const filter = req.query.filter;
    try {
        let query = `
            SELECT
                p.id, p.contenu, p.photo_url, p.created_at,
                pr.prenom, pr.nom, pr.photo AS avatar,
                u.username,
                u.id AS user_id,
                (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id)::int AS likes,
                (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id)::int AS nb_comments,
                EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = \$1) AS liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN profiles pr ON pr.user_id = p.user_id
        `;
        const params = [userId];
        if (filter === 'following') {
            query += ` WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = \$1)`;
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
router.post('/', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const contenu   = (req.body.contenu || '').trim();
    const photoB64  = req.body.photo || null;
    const photoMime = req.body.mime  || 'image/jpeg';
    if (!contenu && !photoB64) {
        return res.status(400).json({ success: false, message: 'Post vide.' });
    }
    try {
        let photo_url = null;
        if (photoB64) {
            const buffer   = Buffer.from(photoB64, 'base64');
            const ext      = photoMime.split('/')[1] || 'jpg';
            const filename = `${userId}_${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from('posts-photos')
                .upload(filename, buffer, { contentType: photoMime, upsert: false });
            if (error) throw new Error(error.message);
            const { data } = supabase.storage.from('posts-photos').getPublicUrl(filename);
            photo_url = data.publicUrl;
        }
        const { rows } = await pool.query(
            `INSERT INTO posts (user_id, contenu, photo_url) VALUES (\$1, \$2, \$3)
             RETURNING id, contenu, photo_url, created_at`,
            [userId, contenu || null, photo_url]
        );
        res.json({ success: true, post: rows[0] });
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
            `SELECT following_id FROM follows WHERE follower_id = \$1`, [userId]
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
            `SELECT id FROM follows WHERE follower_id = \$1 AND following_id = \$2`,
            [followerId, followingId]
        );
        if (rows.length) {
            // Unfollow — pas de notif
            await pool.query(
                `DELETE FROM follows WHERE follower_id = \$1 AND following_id = \$2`,
                [followerId, followingId]
            );
            res.json({ success: true, following: false });
        } else {
            // Follow — notif + push
            await pool.query(
                `INSERT INTO follows (follower_id, following_id) VALUES (\$1, \$2)`,
                [followerId, followingId]
            );

            // Récupérer prenom du follower pour le push
            const { rows: profil } = await pool.query(
                `SELECT prenom, nom FROM profiles WHERE user_id = \$1`, [followerId]
            );
            const prenom = profil[0]?.prenom || 'Quelqu\'un';
            const nom    = profil[0]?.nom    || '';

            // Notif cloche
            await pool.query(
                `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                 VALUES (\$1, 'follow', \$2, \$3)`,
                [followingId, followerId, followerId]
            );

            // Push
            await envoyerPush(
                followingId,
                '👤 Nouvel abonné',
                `${prenom}${nom ? ' ' + nom : ''} a commencé à te suivre`,
                `follow-${followerId}`
            );

            res.json({ success: true, following: true });
        }
    } catch (e) {
        console.error('[FEED FOLLOW]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/comments/:id (édition commentaire) ─────────
router.put('/comments/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const commentId = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    if (!contenu) return res.status(400).json({ success: false, message: 'Contenu vide.' });
    try {
        const { rows } = await pool.query(
            `SELECT user_id FROM post_comments WHERE id = \$1`, [commentId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        await pool.query(`UPDATE post_comments SET contenu = \$1 WHERE id = \$2`, [contenu, commentId]);
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
            `SELECT user_id FROM post_comments WHERE id = \$1`, [commentId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });
        if (rows[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        await pool.query(`DELETE FROM post_comments WHERE id = \$1`, [commentId]);
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
            `SELECT id FROM comment_likes WHERE comment_id = \$1 AND user_id = \$2`,
            [commentId, userId]
        );
        if (rows.length) {
            await pool.query(
                `DELETE FROM comment_likes WHERE comment_id = \$1 AND user_id = \$2`,
                [commentId, userId]
            );
            res.json({ success: true, liked: false });
        } else {
            await pool.query(
                `INSERT INTO comment_likes (comment_id, user_id) VALUES (\$1, \$2)`,
                [commentId, userId]
            );
            res.json({ success: true, liked: true });
        }
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
            `SELECT id FROM post_likes WHERE post_id = \$1 AND user_id = \$2`,
            [postId, userId]
        );
        if (rows.length) {
            // Unlike — pas de notif
            await pool.query(
                `DELETE FROM post_likes WHERE post_id = \$1 AND user_id = \$2`,
                [postId, userId]
            );
            res.json({ success: true, liked: false });
        } else {
            // Like — notif + push si pas son propre post
            await pool.query(
                `INSERT INTO post_likes (post_id, user_id) VALUES (\$1, \$2)`,
                [postId, userId]
            );

            // Récupérer propriétaire du post
            const { rows: postRows } = await pool.query(
                `SELECT user_id FROM posts WHERE id = \$1`, [postId]
            );
            const ownerId = postRows[0]?.user_id;

            if (ownerId && ownerId !== userId) {
                // Récupérer prenom du liker
                const { rows: profil } = await pool.query(
                    `SELECT prenom, nom FROM profiles WHERE user_id = \$1`, [userId]
                );
                const prenom = profil[0]?.prenom || 'Quelqu\'un';
                const nom    = profil[0]?.nom    || '';

                // Notif cloche
                await pool.query(
                    `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                     VALUES (\$1, 'like', \$2, \$3)`,
                    [ownerId, postId, userId]
                );

                // Push
                await envoyerPush(
                    ownerId,
                    '❤️ Nouveau like',
                    `${prenom}${nom ? ' ' + nom : ''} a aimé ta publication`,
                    `like-${postId}-${userId}`
                );
            }

            res.json({ success: true, liked: true });
        }
    } catch (e) {
        console.error('[FEED LIKE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/feed/:id/likes (liste likers) ────────────────────
router.get('/:id/likes', authenticateToken, async (req, res) => {
    const postId = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`
            SELECT pr.prenom, pr.nom, pr.photo AS avatar, u.username
            FROM post_likes l
            JOIN users u ON u.id = l.user_id
            LEFT JOIN profiles pr ON pr.user_id = l.user_id
            WHERE l.post_id = \$1
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
            SELECT c.id, c.contenu, c.created_at,
                   pr.prenom, pr.nom, pr.photo AS avatar,
                   u.username, u.id AS user_id,
                   (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)::int AS likes,
                   EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = \$2) AS liked
            FROM post_comments c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN profiles pr ON pr.user_id = c.user_id
            WHERE c.post_id = \$1
            ORDER BY c.created_at ASC
        `, [postId, userId]);
        res.json({ success: true, comments: rows });
    } catch (e) {
        console.error('[FEED COMMENTS GET]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/feed/:id/comments ───────────────────────────────
router.post('/:id/comments', authenticateToken, async (req, res) => {
    const userId  = req.user.id;
    const postId  = parseInt(req.params.id);
    const contenu = (req.body.contenu || '').trim();
    if (!contenu) return res.status(400).json({ success: false, message: 'Commentaire vide.' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO post_comments (post_id, user_id, contenu) VALUES (\$1, \$2, \$3)
             RETURNING id, contenu, created_at`,
            [postId, userId, contenu]
        );

        // Récupérer propriétaire du post
        const { rows: postRows } = await pool.query(
            `SELECT user_id FROM posts WHERE id = \$1`, [postId]
        );
        const ownerId = postRows[0]?.user_id;

        if (ownerId && ownerId !== userId) {
            // Récupérer prenom du commentateur
            const { rows: profil } = await pool.query(
                `SELECT prenom, nom FROM profiles WHERE user_id = \$1`, [userId]
            );
            const prenom = profil[0]?.prenom || 'Quelqu\'un';
            const nom    = profil[0]?.nom    || '';

            // Notif cloche
            await pool.query(
                `INSERT INTO notifications (user_id, type, ref_id, sender_id)
                 VALUES (\$1, 'comment', \$2, \$3)`,
                [ownerId, rows[0].id, userId]
            );

            // Push
            await envoyerPush(
                ownerId,
                '💬 Nouveau commentaire',
                `${prenom}${nom ? ' ' + nom : ''} a commenté ta publication`,
                `comment-${rows[0].id}`
            );
        }

        res.json({ success: true, comment: rows[0] });
    } catch (e) {
        console.error('[FEED COMMENT POST]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── PUT /api/feed/:id (édition post — contenu + photo) ───────
router.put('/:id', authenticateToken, async (req, res) => {
    const userId    = req.user.id;
    const postId    = parseInt(req.params.id);
    const contenu   = (req.body.contenu || '').trim();
    const photoB64  = req.body.photo     || null;
    const photoMime = req.body.mime      || 'image/jpeg';
    const suppPhoto = req.body.supprimer_photo === true;

    try {
        const { rows } = await pool.query(
            `SELECT user_id, photo_url FROM posts WHERE id = \$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }

        let photo_url = post.photo_url;

        if ((suppPhoto || photoB64) && post.photo_url) {
            const filename = post.photo_url.split('/').pop();
            await supabase.storage.from('posts-photos').remove([filename]);
            photo_url = null;
        }

        if (photoB64) {
            const buffer   = Buffer.from(photoB64, 'base64');
            const ext      = photoMime.split('/')[1] || 'jpg';
            const filename = `${userId}_${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from('posts-photos')
                .upload(filename, buffer, { contentType: photoMime, upsert: false });
            if (error) throw new Error(error.message);
            const { data } = supabase.storage.from('posts-photos').getPublicUrl(filename);
            photo_url = data.publicUrl;
        }

        await pool.query(
            `UPDATE posts SET contenu = \$1, photo_url = \$2 WHERE id = \$3`,
            [contenu || null, photo_url, postId]
        );
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
            `SELECT user_id, photo_url FROM posts WHERE id = \$1`, [postId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post introuvable.' });
        const post = rows[0];
        if (post.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Interdit.' });
        }
        if (post.photo_url) {
            const filename = post.photo_url.split('/').pop();
            await supabase.storage.from('posts-photos').remove([filename]);
        }
        await pool.query(`DELETE FROM posts WHERE id = \$1`, [postId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FEED DELETE]', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
