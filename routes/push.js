// ============================================================
// routes/push.js
// Gestion des abonnements et envoi des notifications push.
// ============================================================

const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const { pool } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

// ── Fonction utilitaire : envoyer un push à un user ──────────
async function envoyerPush(userId, titre, corps, tag = 'mydaily') {
    try {
        const { rows } = await pool.query(
            `SELECT subscription FROM push_subscriptions WHERE user_id = \$1`, [userId]
        );
        if (!rows.length) return;
        const subscription = JSON.parse(rows[0].subscription);
        await webpush.sendNotification(subscription, JSON.stringify({
            titre, corps, tag, url: '/'
        }));
        console.log(`[PUSH] Envoyé user ${userId} — ${tag}`);
    } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
            await pool.query(`DELETE FROM push_subscriptions WHERE user_id = \$1`, [userId]);
            console.warn(`[PUSH] Subscription expirée supprimée user ${userId}`);
        } else {
            console.warn(`[PUSH] envoyerPush user ${userId} :`, e.message);
        }
    }
}

// ── POST /api/push/subscribe ──────────────────────────────────
router.post('/subscribe', authenticateToken, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription) {
        return res.status(400).json({ success: false, message: 'Subscription manquante.' });
    }
    try {
        await pool.query(`
            INSERT INTO push_subscriptions (user_id, subscription, updated_at)
            VALUES (\$1, \$2, NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET subscription = \$2, updated_at = NOW()
        `, [req.user.id, JSON.stringify(subscription)]);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUSH] POST /subscribe :', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── POST /api/push/check ──────────────────────────────────────
// Le client envoie dateLocale et heureLocale (heure du navigateur).
router.post('/check', authenticateToken, async (req, res) => {
    try {
        const { dateLocale, heureLocale } = req.body;
        if (!dateLocale || !heureLocale) {
            return res.status(400).json({ success: false, message: 'dateLocale et heureLocale requis.' });
        }

        const dateAujourdhui = dateLocale;
        const heureActuelle  = heureLocale.substring(0, 5);
        const annee          = parseInt(dateLocale.split('-')[0]);

        console.log(`[PUSH] /check — local ${dateAujourdhui} ${heureActuelle}`);

        const { rows: abonnes } = await pool.query(
            `SELECT user_id FROM push_subscriptions`
        );

        for (const { user_id } of abonnes) {

            // ── Tâches ────────────────────────────────────────
            const { rows: taches } = await pool.query(`
                SELECT id, titre, date, heure, rappel_avant
                FROM taches
                WHERE user_id = \$1 AND faite = FALSE AND heure IS NOT NULL AND date IS NOT NULL AND rappel_avant > 0
            `, [user_id]);

            for (const t of taches) {
                const dateTache  = t.date.toISOString().split('T')[0];
                const heureTache = t.heure.substring(0, 5);
                const rappel     = t.rappel_avant || 0;
                const [th, tm]   = heureTache.split(':').map(Number);
                const [yd, ym, yj] = dateTache.split('-').map(Number);
                const tacheMin   = yd * 525600 + ym * 43800 + yj * 1440 + th * 60 + tm;
                const notifMin   = tacheMin - rappel;
                const [ad, am, aj] = dateAujourdhui.split('-').map(Number);
                const [ah, aminute] = heureActuelle.split(':').map(Number);
                const actuelMin  = ad * 525600 + am * 43800 + aj * 1440 + ah * 60 + aminute;
                if (notifMin !== actuelMin) continue;
                const label = rappel >= 60 ? `${rappel/60}h` : `${rappel}min`;
                await envoyerPush(user_id, '✅ Rappel de tâche', `${t.titre} — dans ${label}`, `tache-${t.id}`);
            }

            // ── Rendez-vous ───────────────────────────────────
            const { rows: rdvs } = await pool.query(`
                SELECT id, titre, date_rdv, rappel_avant
                FROM rendezvous
                WHERE user_id = \$1 AND date_rdv IS NOT NULL AND rappel_avant > 0
            `, [user_id]);

            for (const rdv of rdvs) {
                const rappel     = rdv.rappel_avant || 0;
                const rdvDate    = new Date(rdv.date_rdv);
                const notifDate  = new Date(rdvDate.getTime() - rappel * 60 * 1000);
                const nd = `${notifDate.getUTCFullYear()}-${String(notifDate.getUTCMonth()+1).padStart(2,'0')}-${String(notifDate.getUTCDate()).padStart(2,'0')}`;
                const nh = `${String(notifDate.getUTCHours()).padStart(2,'0')}:${String(notifDate.getUTCMinutes()).padStart(2,'0')}`;
                // RDV stocké en UTC → le client envoie son heure locale → on compare via offset
                // On recalcule en utilisant l'offset du client implicitement via date_rdv
                // Approche : comparer timestamp client vs timestamp notif
                const [cad, cam, caj] = dateAujourdhui.split('-').map(Number);
                const [cah, cam2]     = heureActuelle.split(':').map(Number);
                const clientTs = Date.UTC(cad, cam - 1, caj, cah, cam2);
                const notifTs  = rdvDate.getTime() - rappel * 60 * 1000;
                if (Math.abs(clientTs - notifTs) > 60000) continue;
                const label = rappel >= 1440 ? 'demain' : rappel >= 60 ? `dans ${rappel/60}h` : `dans ${rappel}min`;
                await envoyerPush(user_id, '🩺 Rappel rendez-vous', `${rdv.titre} — ${label}`, `rdv-${rdv.id}`);
            }

            // ── Planning ──────────────────────────────────────
            const { rows: shifts } = await pool.query(`
                SELECT id, type, heure_debut, rappel_avant, employeur
                FROM planning
                WHERE user_id = \$1 AND date = \$2 AND heure_debut IS NOT NULL AND rappel_avant > 0
            `, [user_id, dateAujourdhui]);

            for (const p of shifts) {
                const [ph, pm]   = p.heure_debut.substring(0,5).split(':').map(Number);
                const [ad, am, aj] = dateAujourdhui.split('-').map(Number);
                const [ah, aminute] = heureActuelle.split(':').map(Number);
                const debutMin   = aj * 1440 + ph * 60 + pm;
                const notifMin   = debutMin - p.rappel_avant;
                const actuelMin  = aj * 1440 + ah * 60 + aminute;
                if (notifMin !== actuelMin) continue;
                const label = p.rappel_avant >= 60 ? `${p.rappel_avant/60}h` : `${p.rappel_avant}min`;
                const corps = `${p.type || ''} — dans ${label} (${p.heure_debut.slice(0,5)})${p.employeur ? ' — '+p.employeur : ''}`;
                await envoyerPush(user_id, '📋 Rappel Planning', corps, `planning-${p.id}`);
            }

            // ── Anniversaires (08:00 locale uniquement) ───────
            if (heureActuelle === '08:00') {
                const { rows: annivs } = await pool.query(`
                    SELECT id, prenom, nom, jour, mois, annee
                    FROM anniversaires
                    WHERE user_id = \$1
                `, [user_id]);

                const [ad, am, aj] = dateAujourdhui.split('-').map(Number);
                const demainJ = new Date(Date.UTC(ad, am - 1, aj + 1));

                for (const a of annivs) {
                    const nom = `${a.prenom}${a.nom ? ' '+a.nom : ''}`;
                    if (a.jour === aj && a.mois === am) {
                        const age = a.annee ? ` — ${annee - a.annee} ans` : '';
                        await envoyerPush(user_id, "🎂 Anniversaire aujourd'hui !", `${nom}${age}`, `anniv-${a.id}`);
                    } else if (a.jour === demainJ.getUTCDate() && a.mois === demainJ.getUTCMonth() + 1) {
                        const ageDemain = a.annee ? ` — ${annee - a.annee} ans demain` : '';
                        await envoyerPush(user_id, '🎂 Anniversaire demain !', `${nom}${ageDemain}`, `anniv-veille-${a.id}`);
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('[PUSH] /check :', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
