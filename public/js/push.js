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
