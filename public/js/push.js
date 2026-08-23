// ============================================================
// public/js/push.js
// Notifications push : abonnement VAPID + polling serveur.
// ============================================================

const VAPID_PUBLIC_KEY = 'BFUh_nh-iDi2povrAcCcn9G14kaAqPI0jNesokS5H-sbHEJFA8Hdmfz2UEqPolgqs6W938Er15gz4LqI_UkRnjQ';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ── Initialisation push ───────────────────────────────────────
async function initPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window)) return;

    const user = getUser();
    if (!user?.token) return;

    if (Notification.permission === 'denied') return;

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

        demarrerPolling();
    } catch (e) {
        if (e.name !== 'NotAllowedError') {
            console.warn('[Push] Initialisation échouée :', e.message);
        }
    }
}

// ── Polling serveur toutes les 60s ────────────────────────────
function demarrerPolling() {
    appellerCheck();
    setInterval(appellerCheck, 60 * 1000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') appellerCheck();
    });
}

async function appellerCheck() {
    const user = getUser();
    if (!user?.token) return;
    try {
        await fetch('/api/push/check', {
            method : 'POST',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user.token}`
            }
        });
    } catch (e) {
        console.warn('[Push] /check échoué :', e.message);
    }
}
