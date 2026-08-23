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
    } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
            await pool.query(`DELETE FROM push_subscriptions WHERE user_id = \$1`, [userId]);
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
// Appelé par le client toutes les 60s.
// Vérifie les rappels pour TOUS les utilisateurs abonnés.
router.post('/check', authenticateToken, async (req, res) => {
    try {
        const maintenant     = new Date();
        const annee          = maintenant.getFullYear();
        const mois           = String(maintenant.getMonth() + 1).padStart(2, '0');
        const jour           = String(maintenant.getDate()).padStart(2, '0');
        const dateAujourdhui = `${annee}-${mois}-${jour}`;
        const heureActuelle  = `${String(maintenant.getHours()).padStart(2,'0')}:${String(maintenant.getMinutes()).padStart(2,'0')}`;

        const { rows: abonnes } = await pool.query(
            `SELECT user_id FROM push_subscriptions`
        );

        for (const { user_id } of abonnes) {

            // ── Tâches ────────────────────────────────────────
            const { rows: taches } = await pool.query(`
                SELECT id, titre, date, heure, rappel_avant
                FROM taches
                WHERE user_id = \$1 AND faite = FALSE AND heure IS NOT NULL AND date IS NOT NULL
            `, [user_id]);

            for (const t of taches) {
                const dateTache  = t.date.toISOString().split('T')[0];
                const heureTache = t.heure.substring(0, 5);
                const rappel     = t.rappel_avant || 0;
                const tacheDate  = new Date(`${dateTache}T${heureTache}`);
                const notifDate  = new Date(tacheDate.getTime() - rappel * 60 * 1000);
                const hN = String(notifDate.getHours()).padStart(2, '0');
                const mN = String(notifDate.getMinutes()).padStart(2, '0');
                const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
                if (dN !== dateAujourdhui || `${hN}:${mN}` !== heureActuelle) continue;
                const label = rappel >= 60 ? `${rappel/60}h` : rappel > 0 ? `${rappel}min` : null;
                const corps = label ? `${t.titre} — dans ${label}` : t.titre;
                await envoyerPush(user_id, '✅ Rappel de tâche', corps, `tache-${t.id}`);
            }

            // ── Rendez-vous ───────────────────────────────────
            const { rows: rdvs } = await pool.query(`
                SELECT id, titre, date_rdv, rappel_avant
                FROM rendezvous
                WHERE user_id = \$1 AND date_rdv IS NOT NULL
            `, [user_id]);

            for (const rdv of rdvs) {
                const rappel    = rdv.rappel_avant || 0;
                const rdvDate   = new Date(rdv.date_rdv);
                const notifDate = new Date(rdvDate.getTime() - rappel * 60 * 1000);
                const hN = String(notifDate.getHours()).padStart(2, '0');
                const mN = String(notifDate.getMinutes()).padStart(2, '0');
                const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
                if (dN !== dateAujourdhui || `${hN}:${mN}` !== heureActuelle) continue;
                const label = rappel >= 1440 ? 'demain' : rappel >= 60 ? `dans ${rappel/60}h` : rappel > 0 ? `dans ${rappel}min` : "c'est maintenant";
                await envoyerPush(user_id, '🩺 Rappel rendez-vous', `${rdv.titre} — ${label}`, `rdv-${rdv.id}`);
            }

            // ── Planning ──────────────────────────────────────
            const { rows: shifts } = await pool.query(`
                SELECT id, type, heure_debut, rappel_avant, employeur
                FROM planning
                WHERE user_id = \$1 AND date = \$2 AND heure_debut IS NOT NULL AND rappel_avant > 0
            `, [user_id, dateAujourdhui]);

            for (const p of shifts) {
                const debutDate = new Date(`${dateAujourdhui}T${p.heure_debut}`);
                const notifDate = new Date(debutDate.getTime() - p.rappel_avant * 60 * 1000);
                const hN = String(notifDate.getHours()).padStart(2, '0');
                const mN = String(notifDate.getMinutes()).padStart(2, '0');
                const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
                if (dN !== dateAujourdhui || `${hN}:${mN}` !== heureActuelle) continue;
                const label = p.rappel_avant >= 60 ? `${p.rappel_avant/60}h` : `${p.rappel_avant}min`;
                const corps = `${p.type || ''} — dans ${label} (${p.heure_debut.slice(0,5)})${p.employeur ? ' — '+p.employeur : ''}`;
                await envoyerPush(user_id, '📋 Rappel Planning', corps, `planning-${p.id}`);
            }

            // ── Anniversaires (08:00 uniquement) ──────────────
            if (heureActuelle === '08:00') {
                const { rows: annivs } = await pool.query(`
                    SELECT id, prenom, nom, jour, mois, annee
                    FROM anniversaires
                    WHERE user_id = \$1
                `, [user_id]);

                const jourNow  = maintenant.getDate();
                const moisNow  = maintenant.getMonth() + 1;
                const demain   = new Date(maintenant);
                demain.setDate(maintenant.getDate() + 1);

                for (const a of annivs) {
                    const age = a.annee ? ` — ${annee - a.annee} ans` : '';
                    const nom = `${a.prenom}${a.nom ? ' '+a.nom : ''}`;
                    if (a.jour === jourNow && a.mois === moisNow) {
                        await envoyerPush(user_id, "🎂 Anniversaire aujourd'hui !", `${nom}${age}`, `anniv-${a.id}`);
                    } else if (a.jour === demain.getDate() && a.mois === demain.getMonth() + 1) {
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
