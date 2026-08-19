// ============================================================
// server.js
// Point d'entrée du serveur Express.
// Gère : middlewares globaux, routage, initialisation DB et VAPID.
// ============================================================

const express = require('express');
const webpush  = require('web-push');
const { pool, initDB } = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Désactiver ETag pour les réponses API ─────────────────────
app.set('etag', false);

// ── Parsers ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Fichiers statiques (ETag activé uniquement ici) ───────────
app.use(express.static('public', { etag: true, lastModified: true }));

// ── Anti-cache sur toutes les routes /api ─────────────────────
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma',  'no-cache');
    res.set('Expires', '0');
    next();
});

// ── Initialisation de la base de données ─────────────────────
initDB();

// ── Configuration VAPID (notifications push) ─────────────────
if (!process.env.VAPID_MAILTO || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[VAPID] Variables manquantes — les notifications push seront désactivées.');
} else {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// ── Routes ────────────────────────────────────────────────────
app.use('/api',                require('./routes/auth').router);
app.use('/api/profil',         require('./routes/profil'));
app.use('/api/widget-order',   require('./routes/widgets'));
app.use('/api/taches',         require('./routes/taches'));
app.use('/api/anniversaires',  require('./routes/anniversaires'));
app.use('/api/push',           require('./routes/push'));
app.use('/api/priere',         require('./routes/priere'));
app.use('/api/islam',          require('./routes/islam'));
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/cycle',          require('./routes/cycle'));
app.use('/api/rendezvous',     require('./routes/rendezvous'));
app.use('/api/planning',       require('./routes/planning'));
// ✅ Widget Astrologie — horoscope du jour par signe (scraping horoscope.fr)
app.use('/api/astrologie',     require('./routes/astrologie'));

// ── Middleware de gestion d'erreurs global ────────────────────
app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur inattendue.' });
});

// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => console.log(`[SERVER] Démarré sur le port ${PORT}`));
