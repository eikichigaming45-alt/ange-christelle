const express = require('express');
const { pool, initDB } = require('./db/pool');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Désactiver ETag pour toutes les réponses API ──────────────────────────────
app.set('etag', false);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Assets statiques avec ETag réactivé uniquement pour eux ──────────────────
app.use(express.static('public', { etag: true, lastModified: true }));

// ── Middleware global anti-cache sur /api ─────────────────────────────────────
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

initDB();

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.use('/api',             require('./routes/auth').router);
app.use('/api/profil',      require('./routes/profil'));
app.use('/api/widget-order',require('./routes/widgets'));
app.use('/api/taches',      require('./routes/taches'));
app.use('/api/anniversaires',require('./routes/anniversaires'));
app.use('/api/push',        require('./routes/push'));
app.use('/api/priere', require('./routes/priere'));
app.use('/api/islam',  require('./routes/islam'));   // ajouter cette ligne
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/cycle',       require('./routes/cycle'));
app.use('/api/rendezvous',  require('./routes/rendezvous'));
app.use('/api/planning',    require('./routes/planning'));

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
// Natsumi
