const express = require('express');
const { pool, initDB } = require('./db/pool');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Initialisation de la BDD au démarrage
initDB();

// Configuration VAPID
webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Montage des routes modulaires
app.use('/api', require('./routes/auth').router);
app.use('/api/profil', require('./routes/profil'));
app.use('/api/widget-order', require('./routes/widgets'));
app.use('/api/taches', require('./routes/taches'));
app.use('/api/anniversaires', require('./routes/anniversaires'));
app.use('/api/push', require('./routes/push'));
app.use('/api/priere', require('./routes/priere'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cycle', require('./routes/cycle'));
app.use('/api/rendezvous', require('./routes/rendezvous'));

// ===================== JOB AUTOMATIQUE — NOTIFICATIONS =====================
async function envoyerNotificationsTaches() {
    try {
        const maintenant = new Date();
        const heure = String(maintenant.getHours()).padStart(2, '0');
        const minute = String(maintenant.getMinutes()).padStart(2, '0');
        const heureActuelle = `${heure}:${minute}`;
        const dateAujourdhui = maintenant.toISOString().split('T')[0];

        const result = await pool.query(`
            SELECT t.*, ps.subscription
            FROM taches t
            JOIN push_subscriptions ps ON ps.user_id = t.user_id
            WHERE t.faite = FALSE
            AND t.date = \$1
            AND t.heure IS NOT NULL
            AND TO_CHAR(t.heure, 'HH24:MI') = \$2
        `, [dateAujourdhui, heureActuelle]);

        for (const tache of result.rows) {
            try {
                const subscription = JSON.parse(tache.subscription);
                await webpush.sendNotification(subscription, JSON.stringify({
                    titre: '✅ Rappel de tâche',
                    corps: tache.titre,
                    url: '/',
                    tag: `tache-${tache.id}`
                }));
            } catch (e) {
                if (e.statusCode === 410) {
                    await pool.query('DELETE FROM push_subscriptions WHERE user_id = \$1', [tache.user_id]);
                }
            }
        }
    } catch (e) {
        console.error('Erreur job notifications:', e.message);
    }
}

// Lance le job toutes les minutes
setInterval(envoyerNotificationsTaches, 60 * 1000);

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
