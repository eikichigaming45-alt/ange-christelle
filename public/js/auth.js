// ===================== AUTH & NOTIFICATIONS PUSH =====================

async function enregistrerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        verifierEvenementsJour();
    } catch(e) { console.warn('SW non disponible', e); }
}

async function verifierEvenementsJour() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    const today = new Date().toISOString().split('T')[0];
    const lastCheck = localStorage.getItem(`myvibe_check_${user.userId}`);
    if (lastCheck === today) return;
    localStorage.setItem(`myvibe_check_${user.userId}`, today);

    const now = new Date();
    const jour = now.getDate();
    const mois = now.getMonth() + 1;

    try {
        const ra = await fetch(`/api/anniversaires?userId=${user.userId}`);
        const da = await ra.json();
        if (da.success) {
            da.anniversaires.forEach(a => {
                if (parseInt(a.jour) === jour && parseInt(a.mois) === mois) {
                    const age = a.annee ? ` — ${now.getFullYear() - a.annee} ans` : '';
                    envoyerNotif(
                        `🎂 Anniversaire aujourd'hui !`,
                        `${a.prenom}${a.nom ? ' '+a.nom : ''}${age}`,
                        'anniversaire-'+a.id
                    );
                }
            });
        }

        const rt = await fetch(`/api/taches?userId=${user.userId}`);
        const dt = await rt.json();
        if (dt.success) {
            dt.taches.forEach(t => {
                if (!t.faite && t.date && t.date.split('T')[0] === today) {
                    envoyerNotif(
                        `✅ Tâche du jour`,
                        t.titre,
                        'tache-'+t.id
                    );
                }
            });
        }
    } catch(e) { console.warn('Erreur check événements', e); }
}

function envoyerNotif(titre, corps, tag) {
    if (Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(titre, {
            body: corps,
            icon: '/icon.png',
            tag: tag,
            renotify: false
        });
    });
}

// ===================== LOGIN / LOGOUT =====================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // IDs mis à jour : login-username / login-password
            const username = document.getElementById('login-username')?.value?.trim();
            const password = document.getElementById('login-password')?.value;
            const errEl   = document.getElementById('error-msg');
            if (errEl) errEl.textContent = '';
            try {
                const r = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const d = await r.json();
                if (d.success) {
                    localStorage.setItem('myvibe_user', JSON.stringify({
                        userId  : d.userId,
                        username: d.username,
                        role    : d.role
                    }));
                    document.getElementById('login-page').style.display = 'none';
                    document.getElementById('app').style.display = 'block';
                    if (typeof initialiserApp === 'function') initialiserApp();
                    if (typeof enregistrerServiceWorker === 'function') enregistrerServiceWorker();
                } else {
                    if (errEl) errEl.textContent = d.message || 'Identifiants incorrects.';
                }
            } catch {
                if (errEl) errEl.textContent = 'Erreur réseau.';
            }
        });
    }

    // Auto-login si session active
    const stored = localStorage.getItem('myvibe_user');
    if (stored) {
        try {
            const u = JSON.parse(stored);
            if (u?.userId) {
                document.getElementById('login-page').style.display = 'none';
                document.getElementById('app').style.display = 'block';
                if (typeof initialiserApp === 'function') initialiserApp();
                if (typeof enregistrerServiceWorker === 'function') enregistrerServiceWorker();
            }
        } catch { localStorage.removeItem('myvibe_user'); }
    }
});

function logout() {
    localStorage.removeItem('myvibe_user');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
    // Vider les champs login proprement
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    if (u) u.value = '';
    if (p) p.value = '';
}
