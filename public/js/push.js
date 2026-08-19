// ============================================================
// public/js/push.js
// Authentification : JWT Bearer uniquement.
// ============================================================

const VAPID_PUBLIC_KEY = 'BFUh_nh-iDi2povrAcCcn9G14kaAqPI0jNesokS5H-sbHEJFA8Hdmfz2UEqPolgqs6W938Er15gz4LqI_UkRnjQ';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const user = getUser();
    if (!user?.token) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly     : true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        await fetch('/api/push/subscribe', {
            method : 'POST',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ subscription })
        });
    } catch (e) {
        console.warn('Push init échoué', e);
    }
}

// ── Vérification locale toutes les minutes ──────────────────
const dejaNotifies = new Set();

async function verifierTachesLocales() {
    const user = getUser();
    if (!user?.token) return;

    const maintenant     = new Date();
    const annee          = maintenant.getFullYear();
    const mois           = String(maintenant.getMonth() + 1).padStart(2, '0');
    const jour           = String(maintenant.getDate()).padStart(2, '0');
    const dateAujourdhui = `${annee}-${mois}-${jour}`;
    const heureActuelle  = `${String(maintenant.getHours()).padStart(2,'0')}:${String(maintenant.getMinutes()).padStart(2,'0')}`;

    // ── Tâches ────────────────────────────────────────────
    try {
        const res  = await fetch('/api/taches', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (data.success) {
            for (const tache of data.taches) {
                if (tache.faite || !tache.heure || !tache.date) continue;
                const dateTache  = tache.date.split('T')[0];
                const heureTache = tache.heure.substring(0, 5);
                const rappel     = tache.rappel_avant || 0;
                const tacheDate  = new Date(`${dateTache}T${heureTache}`);
                const notifDate  = new Date(tacheDate.getTime() - rappel * 60 * 1000);
                const hN = String(notifDate.getHours()).padStart(2, '0');
                const mN = String(notifDate.getMinutes()).padStart(2, '0');
                const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
                if (dN !== dateAujourdhui) continue;
                if (`${hN}:${mN}` !== heureActuelle) continue;
                const cle = `tache-${tache.id}-${dN}-${hN}:${mN}`;
                if (dejaNotifies.has(cle)) continue;
                dejaNotifies.add(cle);
                const corps = rappel > 0
                    ? `${tache.titre} — dans ${rappel >= 60 ? rappel/60+'h' : rappel+'min'}`
                    : tache.titre;
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification('✅ Rappel de tâche', {
                    body: corps, icon: '/icon-192.png', badge: '/icon-192.png',
                    tag: `tache-${tache.id}`, renotify: true, data: { url: '/' }
                });
            }
        }
    } catch (e) { console.warn('Erreur tâches push:', e); }

    // ── Rendez-vous ───────────────────────────────────────
    try {
        const res  = await fetch('/api/rendezvous', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json();
        // ✅ Fix : destructuration correcte { success, rendezvous }
        const rdvs = data.rendezvous || [];
        for (const rdv of rdvs) {
            if (!rdv.date_rdv) continue;
            const rappel    = rdv.rappel_avant || 0;
            const rdvDate   = new Date(rdv.date_rdv);
            const notifDate = new Date(rdvDate.getTime() - rappel * 60 * 1000);
            const hN = String(notifDate.getHours()).padStart(2, '0');
            const mN = String(notifDate.getMinutes()).padStart(2, '0');
            const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
            if (dN !== dateAujourdhui) continue;
            if (`${hN}:${mN}` !== heureActuelle) continue;
            const cle = `rdv-${rdv.id}-${dN}-${hN}:${mN}`;
            if (dejaNotifies.has(cle)) continue;
            dejaNotifies.add(cle);
            const label = rappel >= 1440 ? 'demain' : rappel >= 60 ? `dans ${rappel/60}h` : rappel > 0 ? `dans ${rappel}min` : "c'est maintenant";
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification('🩺 Rappel rendez-vous', {
                body: `${rdv.titre} — ${label}`, icon: '/icon-192.png', badge: '/icon-192.png',
                tag: `rdv-${rdv.id}`, renotify: true, data: { url: '/' }
            });
        }
    } catch (e) { console.warn('Erreur RDV push:', e); }

    // ── Planning ──────────────────────────────────────────
    try {
        const res      = await fetch(`/api/planning/jour?date=${dateAujourdhui}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data     = await res.json();
        const planning = Array.isArray(data) ? data : (data.planning || []);
        for (const p of planning) {
            if (!p.heure_debut || !p.rappel_avant || p.rappel_avant === 0) continue;
            const debutDate = new Date(`${dateAujourdhui}T${p.heure_debut}`);
            const notifDate = new Date(debutDate.getTime() - p.rappel_avant * 60 * 1000);
            const hN = String(notifDate.getHours()).padStart(2, '0');
            const mN = String(notifDate.getMinutes()).padStart(2, '0');
            const dN = `${notifDate.getFullYear()}-${String(notifDate.getMonth()+1).padStart(2,'0')}-${String(notifDate.getDate()).padStart(2,'0')}`;
            if (dN !== dateAujourdhui) continue;
            if (`${hN}:${mN}` !== heureActuelle) continue;
            const cle = `planning-${p.id}-${dN}-${hN}:${mN}`;
            if (dejaNotifies.has(cle)) continue;
            dejaNotifies.add(cle);
            const label = p.rappel_avant >= 60 ? `${p.rappel_avant/60}h` : `${p.rappel_avant}min`;
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification('📋 Rappel Planning', {
                body: `${p.type} — dans ${label} (${p.heure_debut.slice(0,5)}) — ${p.employeur || ''}`,
                icon: '/icon-192.png', badge: '/icon-192.png',
                tag: `planning-${p.id}`, renotify: true, data: { url: '/' }
            });
        }
    } catch (e) { console.warn('Erreur planning push:', e); }

    // ── Anniversaires ─────────────────────────────────────
    try {
        const res  = await fetch('/api/anniversaires', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (data.success) {
            // ✅ Fix : wrap conditionnel au lieu de return
            if (heureActuelle === '08:00') {
                const now     = new Date();
                const jourNow = now.getDate();
                const moisNow = now.getMonth() + 1;
                for (const a of data.anniversaires) {
                    if (a.jour === jourNow && a.mois === moisNow) {
                        const cle = `anniv-jour-${a.id}-${dateAujourdhui}`;
                        if (dejaNotifies.has(cle)) continue;
                        dejaNotifies.add(cle);
                        const age = a.annee ? ` — ${now.getFullYear() - a.annee} ans` : '';
                        const reg = await navigator.serviceWorker.ready;
                        reg.showNotification('🎂 Anniversaire aujourd\'hui !', {
                            body: `${a.prenom}${a.nom ? ' '+a.nom : ''}${age}`,
                            icon: '/icon-192.png', badge: '/icon-192.png',
                            tag: `anniv-${a.id}`, renotify: true, data: { url: '/' }
                        });
                    }
                    const demain = new Date(now);
                    demain.setDate(now.getDate() + 1);
                    if (a.jour === demain.getDate() && a.mois === demain.getMonth() + 1) {
                        const cle = `anniv-veille-${a.id}-${dateAujourdhui}`;
                        if (dejaNotifies.has(cle)) continue;
                        dejaNotifies.add(cle);
                        const age = a.annee ? ` — ${demain.getFullYear() - a.annee} ans demain` : '';
                        const reg = await navigator.serviceWorker.ready;
                        reg.showNotification('🎂 Anniversaire demain !', {
                            body: `${a.prenom}${a.nom ? ' '+a.nom : ''}${age}`,
                            icon: '/icon-192.png', badge: '/icon-192.png',
                            tag: `anniv-veille-${a.id}`, renotify: true, data: { url: '/' }
                        });
                    }
                }
            }
        }
    } catch (e) { console.warn('Erreur anniversaires push:', e); }
}

setInterval(verifierTachesLocales, 60 * 1000);
verifierTachesLocales();
