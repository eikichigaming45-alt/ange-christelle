// ===================== PUSH NOTIFICATIONS =====================

const VAPID_PUBLIC_KEY = 'BFUh_nh-iDi2povrAcCcn9G14kaAqPI0jNesokS5H-sbHEJFA8Hdmfz2UEqPolgqs6W938Er15gz4LqI_UkRnjQ';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, subscription })
        });
    } catch (e) {
        console.warn('Push init échoué', e);
    }
}

// ── Vérification locale des tâches toutes les minutes ──────
const tachesDejaNotifiees = new Set();

async function verifierTachesLocales() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId || !user?.token) return;

    const maintenant = new Date();
    const heure   = String(maintenant.getHours()).padStart(2, '0');
    const minute  = String(maintenant.getMinutes()).padStart(2, '0');
    const heureActuelle = `${heure}:${minute}`;

    // Date locale (pas UTC)
    const annee = maintenant.getFullYear();
    const mois  = String(maintenant.getMonth() + 1).padStart(2, '0');
    const jour  = String(maintenant.getDate()).padStart(2, '0');
    const dateAujourdhui = `${annee}-${mois}-${jour}`;

    try {
        const res = await fetch(`/api/taches?userId=${user.userId}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (!data.success) return;

        for (const tache of data.taches) {
            if (tache.faite) continue;
            if (!tache.heure) continue;
            if (!tache.date) continue;

            // Date de la tâche (extrait YYYY-MM-DD)
            const dateTache = tache.date.split('T')[0];
            // Heure de la tâche (extrait HH:MM)
            const heureTache = tache.heure.substring(0, 5);

            if (dateTache !== dateAujourdhui) continue;
            if (heureTache !== heureActuelle) continue;

            // Évite les doublons
            const cle = `${tache.id}-${dateAujourdhui}-${heureActuelle}`;
            if (tachesDejaNotifiees.has(cle)) continue;
            tachesDejaNotifiees.add(cle);

            // Affiche la notification via le Service Worker
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification('✅ Rappel de tâche', {
                body: tache.titre,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: `tache-${tache.id}`,
                renotify: true,
                data: { url: '/' }
            });
        }
    } catch (e) {
        console.warn('Erreur vérification tâches:', e);
    }
}

// Démarre la vérification toutes les minutes
setInterval(verifierTachesLocales, 60 * 1000);
// Vérifie aussi au chargement
verifierTachesLocales();
