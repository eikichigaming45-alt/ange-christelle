// ============================================================
// server.js
// ============================================================

const express  = require('express');
const webpush  = require('web-push');
const { pool, initDB } = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.set('etag', false);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static('public', { etag: true, lastModified: true }));

app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma',  'no-cache');
    res.set('Expires', '0');
    next();
});

// ── Configuration VAPID ───────────────────────────────────────
if (!process.env.VAPID_MAILTO || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[VAPID] Variables manquantes — notifications push désactivées.');
} else {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// ── Routes ────────────────────────────────────────────────────
app.use('/api',               require('./routes/auth').router);
app.use('/api',               require('./routes/changelog'));
app.use('/api/profil',        require('./routes/profil'));
app.use('/api/sante',         require('./routes/sante'));
app.use('/api/widget-order',  require('./routes/widgets'));
app.use('/api/taches',        require('./routes/taches'));
app.use('/api/anniversaires', require('./routes/anniversaires'));
app.use('/api/push',          require('./routes/push').router);
app.use('/api/priere',        require('./routes/priere'));
app.use('/api/islam',         require('./routes/islam'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/cycle',         require('./routes/cycle'));
app.use('/api/rendezvous',    require('./routes/rendezvous'));
app.use('/api/planning',      require('./routes/planning'));
app.use('/api/astrologie',    require('./routes/astrologie'));
app.use('/api/feed',          require('./routes/feed'));
app.use('/api/social',        require('./routes/social'));

// ── Middleware erreurs global ─────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur inattendue.' });
});

// ── Démarrage — FIX : await initDB() avant d'écouter ─────────
(async () => {
    try {
        await initDB();
        app.listen(PORT, () => console.log(`[SERVER] Démarré sur le port ${PORT}`));
    } catch (err) {
        console.error('[SERVER] Échec initDB — arrêt :', err.message);
        process.exit(1);
    }
})();
