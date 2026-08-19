// ============================================================
// public/js/app.js
// Point d'entrée front : état global, login, logout, init app,
// utilitaires date/version, refresh widgets.
// ============================================================

// ===================== STATE GLOBAL ==========================
// Variables partagées entre les modules front.
// Chaque module qui en a besoin y accède directement.
let meteoData      = null;
let priere         = null;
let profilCache    = null;
let dragSrc        = null;
let longPressTimer = null;
let dragActif      = false;
let cropperInstance = null;
let _appInitialisee = false;

// ===================== DÉFINITION DES WIDGETS ================
// WIDGETS_DEF : configuration complète de chaque widget (grille).
// TOUS_WIDGETS : liste des widgets configurables en opt-out (profil).
// Les widgets 'profil' et 'admin' sont exclus de TOUS_WIDGETS
// car ils sont toujours visibles et non décochables.

const WIDGETS_DEF = [
    { id:'meteo',         label:'Météo du jour',      icon:'🌤️', cls:'w-meteo',         desc:'Chargement...',  foot:'Cliquez pour les détails',         refresh:true },
    { id:'priere',        label:'Prière du jour',     icon:'🙏',  cls:'w-priere',        desc:'Chargement...',  foot:'Cliquez pour la version complète', refresh:true },
    { id:'islam',         label:'Prières & Hadiths',  icon:'☪️',  cls:'w-islam',         desc:'Chargement...',  foot:'Cliquez pour la version complète', refresh:true },
    { id:'taches',        label:'Tâches du jour',     icon:'✅',  cls:'w-taches',        desc:'Chargement...',  foot:'Cliquez pour gérer' },
    { id:'cycle',         label:'Suivi du cycle',     icon:'🌸',  cls:'w-cycle',         desc:'Chargement...',  foot:'Cliquez pour gérer',               refresh:true },
    { id:'rendezvous',    label:'Rendez-vous',         icon:'🩺',  cls:'w-rdv',           desc:'Chargement...',  foot:'Cliquez pour gérer',               refresh:true },
    { id:'planning',      label:'Planning',            icon:'📋',  cls:'w-planning',      desc:'',               foot:'Cliquez pour gérer' },
    { id:'anniversaires', label:'Anniversaires',       icon:'🎂',  cls:'w-anniversaires', desc:'Chargement...',  foot:'Cliquez pour gérer' },
    { id:'profil',        label:'Mon Profil',          icon:'👤',  cls:'w-profil',        desc:'',               foot:'Cliquez pour gérer' },
];

const TOUS_WIDGETS = [
    { slug:'meteo',         label:'🌤️ Météo' },
    { slug:'priere',        label:'🙏 Prière du jour' },
    { slug:'islam',         label:'☪️ Prières & Hadiths' },
    { slug:'planning',      label:'📋 Planning' },
    { slug:'rendezvous',    label:'🩺 Rendez-vous' },
    { slug:'cycle',         label:'🌸 Suivi du cycle' },
    { slug:'taches',        label:'✅ Tâches' },
    { slug:'anniversaires', label:'🎂 Anniversaires' },
];

// ===================== CODES MÉTÉO ===========================
const codes = {
    0:'Ciel dégagé ☀️', 1:'Principalement dégagé 🌤️', 2:'Partiellement nuageux ⛅',
    3:'Couvert ☁️', 45:'Brouillard 🌫️', 48:'Brouillard givrant 🌫️',
    51:'Bruine légère 🌦️', 61:'Pluie légère 🌧️', 63:'Pluie modérée 🌧️',
    65:'Forte pluie 🌧️', 71:'Neige légère 🌨️', 80:'Averses 🌦️',
    95:'Orage ⛈️', 99:'Orage avec grêle ⛈️'
};

// ===================== UTILITAIRE SESSION ====================
function getUser() {
    try {
        return JSON.parse(localStorage.getItem('myvibe_user')) || null;
    } catch { return null; }
}

// ===================== AFFICHAGE RAPIDE ======================
// Masque la page login immédiatement si session active,
// avant même que le DOM soit complètement chargé.
(function() {
    const user = getUser();
    if (user?.token) {
        const loginPage = document.getElementById('login-page');
        const app       = document.getElementById('app');
        if (loginPage) loginPage.style.display = 'none';
        if (app) {
            app.style.display        = 'flex';
            document.body.style.background  = '#f3f4f6';
            document.body.style.alignItems  = 'stretch';
        }
    }
})();

// ===================== INIT AU CHARGEMENT ====================
window.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (user?.token) {
        showApp();
    } else {
        localStorage.removeItem('myvibe_user');
    }
});

// ===================== LOGIN =================================
// Seul listener de login — public/js/auth.js supprimé.
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errEl    = document.getElementById('error-msg');
    if (errEl) errEl.textContent = '';
    try {
        const r = await fetch('/api/login', {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify({ username, password })
        });
        const d = await r.json();
        if (d.success) {
            localStorage.setItem('myvibe_user', JSON.stringify({
                username : d.username,
                role     : d.role,
                userId   : d.userId,
                token    : d.token
            }));
            if (d.mustChangePassword) {
                afficherModaleChangementMdpObligatoire(d.userId);
            } else {
                showApp();
            }
        } else {
            if (errEl) errEl.textContent = d.message || 'Identifiants incorrects.';
        }
    } catch {
        if (errEl) errEl.textContent = 'Erreur réseau.';
    }
});

// ===================== SHOW APP ==============================
async function showApp() {
    if (_appInitialisee) return;
    _appInitialisee = true;

    document.getElementById('login-page').style.display  = 'none';
    document.getElementById('app').style.display         = 'flex';
    document.body.style.background                       = '#f3f4f6';
    document.body.style.alignItems                       = 'stretch';

    afficherDate();
    afficherVersion();
    await buildGrid();

    chargerPriere();
    if (typeof window.chargerIslam === 'function') window.chargerIslam();
    chargerMeteoAuto();
    setTimeout(() => {
        if (typeof chargerWidgetTaches === 'function') chargerWidgetTaches();
    }, 300);
    chargerWidgetAnniversaires();

    const user = getUser();
    if (user?.role === 'admin') chargerWidgetAdmin();

    enregistrerServiceWorker();
    initPush();
}

// ===================== LOGOUT ================================
// Réinitialise l'état complet sans rechargement de page.
// Le layout login-card est géré par style.css (flex-direction:column)
// et non par des styles inline — pas de patch nécessaire.
function logout() {
    localStorage.removeItem('myvibe_user');

    // Réinitialisation de l'état global
    _appInitialisee = false;
    gridConstruit   = false;
    profilCache     = null;
    meteoData       = null;
    priere          = null;

    // Réinitialisation de l'interface
    document.getElementById('app').style.display        = 'none';
    document.getElementById('main-grid').innerHTML      = '';
    document.body.style.background                      = '';
    document.body.style.alignItems                      = '';
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('username').value           = '';
    document.getElementById('password').value           = '';
    const errEl = document.getElementById('error-msg');
    if (errEl) errEl.textContent = '';
}

// ===================== ACTUALISER ============================
function actualiser() {
    afficherDate();
    chargerPriere();
    if (typeof window.chargerIslam === 'function') window.chargerIslam();
    chargerMeteoAuto();
    chargerProfilHeader();
    if (typeof chargerWidgetTaches    === 'function') chargerWidgetTaches();
    chargerWidgetAnniversaires();
    chargerWidgetPlanning();
    if (typeof Cycle      !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();
    const user = getUser();
    if (user?.role === 'admin') chargerWidgetAdmin();
}

// ===================== CHANGEMENT MDP OBLIGATOIRE ============
function afficherModaleChangementMdpObligatoire(userId) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display        = 'flex';
    document.body.style.background                      = '#f3f4f6';
    document.body.style.alignItems                      = 'stretch';
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent  = '🔑 Changement de mot de passe requis';
    document.getElementById('modal-body').innerHTML = `
        <div style="background:#fff7ed;border-radius:12px;padding:16px;margin-bottom:20px;
                    border-left:4px solid #f59e0b;font-size:13px;color:#92400e">
            Votre mot de passe actuel ne respecte pas les règles de sécurité.
            Vous devez le changer avant de continuer.
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:16px;text-align:center">
            8 car. min · majuscule · minuscule · chiffre · caractère spécial
        </div>
        <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Ancien mot de passe</label>
            <input type="password" id="force-mdp-ancien" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nouveau mot de passe</label>
            <input type="password" id="force-mdp-nouveau" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <div style="margin-bottom:20px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Confirmer le mot de passe</label>
            <input type="password" id="force-mdp-confirm" placeholder="••••••••"
                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
        </div>
        <button onclick="validerChangementMdpObligatoire(${userId})"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);
                   color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;
                   cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3)">
            🔑 Changer le mot de passe
        </button>
        <div id="force-mdp-msg" style="text-align:center;margin-top:12px;font-size:13px;min-height:18px"></div>
    `;
    document.getElementById('overlay').onclick    = null;
    document.querySelector('.mclos').style.display = 'none';
}

async function validerChangementMdpObligatoire(userId) {
    const ancien  = document.getElementById('force-mdp-ancien').value;
    const nouveau = document.getElementById('force-mdp-nouveau').value;
    const confirm = document.getElementById('force-mdp-confirm').value;
    const msg     = document.getElementById('force-mdp-msg');
    if (nouveau !== confirm) {
        msg.style.color = '#ef4444';
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        return;
    }
    try {
        const user = getUser();
        const r = await fetch('/api/profil/changer-mdp', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user?.token}`
            },
            body: JSON.stringify({ ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.style.color = '#10b981';
            msg.textContent = '✅ Mot de passe changé !';
            document.querySelector('.mclos').style.display = '';
            document.getElementById('overlay').onclick     = closeOutside;
            setTimeout(() => {
                document.getElementById('overlay').classList.remove('on');
                showApp();
            }, 1000);
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
        }
    } catch {
        msg.style.color = '#ef4444';
        msg.textContent = '❌ Erreur réseau.';
    }
}

// ===================== DATE & VERSION ========================
function afficherDate() {
    const now = new Date();
    const el  = document.getElementById('date-display');
    if (el) el.textContent = now.toLocaleDateString('fr-FR', {
        weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
}

async function afficherVersion() {
    try {
        const r     = await fetch('/sw.js');
        const txt   = await r.text();
        const match = txt.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
            const el = document.querySelector('.footer');
            if (el) el.innerHTML = `<span style="font-size:13px;font-weight:600;color:#333">${match[1]}</span>`;
        }
    } catch { /* silencieux — non critique */ }
}

// ===================== REFRESH WIDGET ========================
function refreshWidget(id) {
    switch (id) {
        case 'meteo':      chargerMeteoAuto();                                                    break;
        case 'priere':     chargerPriere();                                                       break;
        case 'islam':      if (typeof window.chargerIslam === 'function') window.chargerIslam();  break;
        case 'cycle':      if (typeof Cycle      !== 'undefined') Cycle.charger();                break;
        case 'rendezvous': if (typeof Rendezvous !== 'undefined') Rendezvous.charger();           break;
        case 'planning':   chargerWidgetPlanning();                                               break;
    }
}

// ===================== PROFIL HEADER =========================
async function chargerProfilHeader() {
    const user = getUser();
    if (!user?.token) return;
    const btn = document.getElementById('btn-profil-header');
    if (!btn) return;
    try {
        const r = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success || !d.profil) return;
        profilCache = d.profil;
        const p        = d.profil;
        const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase() || '';

        if (p.photo) {
            btn.innerHTML = `<img src="${p.photo}" alt="profil">`;
        } else if (initiales) {
            btn.innerHTML          = initiales;
            btn.style.fontSize     = '13px';
            btn.style.fontWeight   = '700';
        } else {
            btn.innerHTML = '👤';
        }

        const wc = document.getElementById('wc-profil');
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';
        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return `${a} ans`;
        })() : '';

        wc.innerHTML = `
            <div class="profil-widget">
                ${p.photo
                    ? `<img src="${p.photo}" alt="profil" class="profil-widget-photo">`
                    : `<div class="profil-widget-initiales">${initiales || '👤'}</div>`
                }
                <div class="profil-widget-nom">${nom}</div>
                ${age          ? `<div class="profil-widget-info">${age}</div>`           : ''}
                ${p.profession ? `<div class="profil-widget-info">💼 ${p.profession}</div>` : ''}
                ${p.telephone  ? `<div class="profil-widget-info">📞 ${p.telephone}</div>`  : ''}
                ${p.note       ? `<div class="profil-widget-bio">${p.note}</div>`           : ''}
                <button class="profil-widget-btn" onclick="openModal('profil')">✏️ Modifier</button>
            </div>
        `;
    } catch { /* silencieux — non critique */ }
}

// ===================== SERVICE WORKER ========================
function enregistrerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}
