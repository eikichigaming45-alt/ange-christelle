// ============================================================
// routes/push.js
// Notifications push : abonnement VAPID + polling serveur.
// Rappels : tâches, agenda (remplace rendezvous + planning),
// anniversaires.
// ============================================================

const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── envoyerPush : multi-device, purge 410/404 ────────────────
async function envoyerPush(userId, titre, corps, tag = 'moadja') {
    try {
        const { rows } = await pool.query(
            `SELECT id, subscription FROM push_subscriptions WHERE user_id = \$1`,
            [userId]
        );
        if (!rows.length) return;

        for (const row of rows) {
            try {
                const subscription = JSON.parse(row.subscription);
                await webpush.sendNotification(subscription, JSON.stringify({
                    titre, corps, tag, url: '/'
                }));
                console.log(`[PUSH] Envoyé user ${userId} — ${tag}`);
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await pool.query(
                        `DELETE FROM push_subscriptions WHERE id = \$1`, [row.id]
                    );
                    console.warn(`[PUSH] Subscription expirée supprimée (id=${row.id})`);
                } else {
                    console.warn(`[PUSH] Erreur user ${userId} :`, e.message);
                }
            }
        }
    } catch (e) {
        console.warn(`[PUSH] envoyerPush user ${userId} :`, e.message);
    }
}

// ── POST /api/push/subscribe ──────────────────────────────────
router.post('/subscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription) {
        return res.status(400).json({ success: false, message: 'Subscription manquante.' });
    }
    const subStr   = JSON.stringify(subscription);
    const endpoint = subscription.endpoint;

    try {
        const { rows } = await pool.query(`
            SELECT id FROM push_subscriptions
            WHERE user_id = \$1
              AND subscription::json->>'endpoint' = \$2
            LIMIT 1
        `, [req.user.id, endpoint]);

        if (rows.length > 0) {
            await pool.query(`
                UPDATE push_subscriptions
                SET subscription = \$1, updated_at = NOW()
                WHERE id = \$2
            `, [subStr, rows[0].id]);
        } else {
            await pool.query(`
                INSERT INTO push_subscriptions (user_id, subscription, updated_at)
                VALUES (\$1, \$2, NOW())
            `, [req.user.id, subStr]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[PUSH] POST /subscribe :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/push/check ──────────────────────────────────────
router.post('/check', authenticateToken, async (req, res) => {
    try {
        const { dateLocale, heureLocale } = req.body;
        if (!dateLocale || !heureLocale) {
            return res.status(400).json({ success: false, message: 'dateLocale et heureLocale requis.' });
        }

        const heureActuelle    = heureLocale.substring(0, 5);
        const annee            = parseInt(dateLocale.split('-')[0]);
        const user_id          = req.user.id;
        const [ah, amin]       = heureActuelle.split(':').map(Number);
        const [cy, cm, cd]     = dateLocale.split('-').map(Number);
        const clientTs         = Date.UTC(cy, cm - 1, cd, ah, amin);

        console.log(`[PUSH] /check — local ${dateLocale} ${heureActuelle}`);

        // ── Tâches ────────────────────────────────────────────
        const { rows: taches } = await pool.query(`
            SELECT id, titre, date, heure, rappel_avant
            FROM taches
            WHERE user_id = \$1
              AND faite = FALSE
              AND heure IS NOT NULL
              AND date IS NOT NULL
              AND rappel_avant > 0
        `, [user_id]);

        for (const t of taches) {
            const dateTache    = t.date.toISOString().split('T')[0];
            const heureTache   = t.heure.substring(0, 5);
            const [ty, tm, td] = dateTache.split('-').map(Number);
            const [th, tmin]   = heureTache.split(':').map(Number);
            const tacheTs      = Date.UTC(ty, tm - 1, td, th, tmin);
            const rappel       = t.rappel_avant || 0;
            const notifTs      = tacheTs - rappel * 60 * 1000;
            if (Math.abs(clientTs - notifTs) > 60000) continue;
            const label = rappel >= 60 ? `${rappel / 60}h` : `${rappel}min`;
            await envoyerPush(user_id, '✅ Rappel de tâche', `${t.titre} — dans ${label}`, `tache-${t.id}`);
        }

        // ── Agenda (remplace rendezvous + planning) ───────────
        // Récupère toutes les entrées agenda du jour avec rappel
        const { rows: entrees } = await pool.query(`
            SELECT id, titre, categorie, sous_categorie,
                   date_debut, heure_debut, rappel_avant
            FROM agenda
            WHERE user_id = \$1
              AND date_debut = \$2
              AND heure_debut IS NOT NULL
              AND rappel_avant > 0
        `, [user_id, dateLocale]);

        for (const e of entrees) {
            const heure    = e.heure_debut.substring(0, 5);
            const [eh, em] = heure.split(':').map(Number);
            const entreeTs = Date.UTC(cy, cm - 1, cd, eh, em);
            const rappel   = e.rappel_avant || 0;
            const notifTs  = entreeTs - rappel * 60 * 1000;
            if (Math.abs(clientTs - notifTs) > 60000) continue;
            const label     = rappel >= 1440 ? 'demain'
                            : rappel >= 60   ? `dans ${rappel / 60}h`
                            : `dans ${rappel}min`;
            const sousCat   = e.sous_categorie ? ` — ${e.sous_categorie}` : '';
            const icones    = {
                'Travail': '💼', 'Mission': '🧳', 'Repos': '😴',
                'Médical': '🩺', 'Sport': '🏃', 'Sortie': '🎉',
                'Famille': '👨‍👩‍👧', 'Administratif': '📋',
                'Voyage': '✈️', 'Autre': '📌'
            };
            const icone = icones[e.categorie] || '📅';
            await envoyerPush(
                user_id,
                `${icone} ${e.categorie}${sousCat}`,
                `${e.titre} — ${label} (${heure})`,
                `agenda-${e.id}`
            );
        }

        // ── Anniversaires (08:00 locale) ──────────────────────
        if (heureActuelle === '08:00') {
            const { rows: annivs } = await pool.query(`
                SELECT id, prenom, nom, jour, mois, annee
                FROM anniversaires
                WHERE user_id = \$1
            `, [user_id]);

            const demain = new Date(Date.UTC(cy, cm - 1, cd + 1));

            for (const a of annivs) {
                const nom = `${a.prenom}${a.nom ? ' ' + a.nom : ''}`;
                if (a.jour === cd && a.mois === cm) {
                    const age = a.annee ? ` — ${annee - a.annee} ans` : '';
                    await envoyerPush(user_id, "🎂 Anniversaire aujourd'hui !", `${nom}${age}`, `anniv-${a.id}`);
                } else if (a.jour === demain.getUTCDate() && a.mois === demain.getUTCMonth() + 1) {
                    const ageDemain = a.annee ? ` — ${annee - a.annee} ans demain` : '';
                    await envoyerPush(user_id, '🎂 Anniversaire demain !', `${nom}${ageDemain}`, `anniv-veille-${a.id}`);
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('[PUSH] /check :', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = { router, envoyerPush };
