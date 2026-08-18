// ===================== STATE GLOBAL =====================
let meteoData = null;
let dernierIndex = -1;
let priere = null;
let profilCache = null;
let dragSrc = null;
let longPressTimer = null;
let dragActif = false;
let cropperInstance = null;

const WIDGETS_DEF = [
    { id:'meteo',         label:'Météo du jour',    icon:'🌤️', cls:'w-meteo',         desc:'Chargement...',               foot:'Cliquez pour les détails',        refresh:true },
    { id:'priere',        label:'Prière du jour',   icon:'🙏',  cls:'w-priere',        desc:'Chargement...',               foot:'Cliquez pour la version complète', refresh:true },
    { id:'taches',        label:'Tâches du jour',   icon:'✅',  cls:'w-taches',        desc:'Chargement...',               foot:'Cliquez pour gérer' },
    { id:'cycle',         label:'Suivi du cycle',   icon:'🌸',  cls:'w-cycle',         desc:'Chargement...',               foot:'Cycle féminin & fertilité',        refresh:true },
    { id:'rendezvous',    label:'Rendez-vous',      icon:'🩺',  cls:'w-rdv',           desc:'Chargement...',               foot:'Consultations & santé',            refresh:true },
    { id:'planning',      label:'Planning',          icon:'📋',  cls:'w-planning',      desc:'',                            foot:'' },
    { id:'anniversaires', label:'Anniversaires',     icon:'🎂',  cls:'w-anniversaires', desc:'Chargement...',               foot:'Cliquez pour gérer' },
    { id:'profil',        label:'Mon Profil',        icon:'👤',  cls:'w-profil',        desc:'',                            foot:'' },
    { id:'admin',         label:'Administration',    icon:'⚙️',  cls:'w-admin',         desc:'',                            foot:'', adminOnly:true },
];

const codes = {
    0:'Ciel dégagé ☀️',1:'Principalement dégagé 🌤️',2:'Partiellement nuageux ⛅',
    3:'Couvert ☁️',45:'Brouillard 🌫️',48:'Brouillard givrant 🌫️',
    51:'Bruine légère 🌦️',61:'Pluie légère 🌧️',63:'Pluie modérée 🌧️',
    65:'Forte pluie 🌧️',71:'Neige légère 🌨️',80:'Averses 🌦️',
    95:'Orage ⛈️',99:'Orage avec grêle ⛈️'
};

// ===================== INIT =====================

(function() {
    try {
        const stored = localStorage.getItem('myvibe_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.token) {
                document.getElementById('login-page').style.display = 'none';
                document.getElementById('app').style.display = 'flex';
                document.body.style.background = '#f3f4f6';
                document.body.style.alignItems = 'stretch';
            }
        }
    } catch(e) {}
})();

window.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('myvibe_user');
    if (stored) {
        const user = JSON.parse(stored);
        if (user?.token) showApp();
        else localStorage.removeItem('myvibe_user');
    }
});

document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    document.getElementById('error-msg').textContent = '';
    const r = await fetch('/api/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username, password})
    });
    const d = await r.json();
    if (d.success) {
        localStorage.setItem('myvibe_user', JSON.stringify({
            username,
            role  : d.role,
            userId: d.userId,
            token : d.token
        }));
        if (d.mustChangePassword) {
            afficherModaleChangementMdpObligatoire(d.userId);
        } else {
            showApp();
        }
    } else {
        document.getElementById('error-msg').textContent = d.message;
    }
});

let _appInitialisee = false;

async function showApp() {
    if (_appInitialisee) return;
    _appInitialisee = true;

    document.getElementById('login-page').style.display = 'none';
    document.body.style.background = '#f3f4f6';
    document.body.style.alignItems = 'stretch';
    document.getElementById('app').style.display = 'flex';

    afficherDate();
    afficherVersion();
    await buildGrid();

    chargerPriere();
    chargerMeteoAuto();
    chargerProfilHeader();
    setTimeout(() => {
        if (typeof chargerWidgetTaches === 'function') chargerWidgetTaches();
    }, 300);
    chargerWidgetAnniversaires();
    chargerWidgetPlanning();
    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();

    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (user?.role === 'admin') {
        chargerWidgetAdmin();
    }

    enregistrerServiceWorker();
    initPush();
}

function actualiser() {
    afficherDate();
    chargerPriere();
    chargerMeteoAuto();
    chargerProfilHeader();
    if (typeof chargerWidgetTaches === 'function') chargerWidgetTaches();
    chargerWidgetAnniversaires();
    chargerWidgetPlanning();
    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (user?.role === 'admin') chargerWidgetAdmin();
}

function logout() {
    localStorage.removeItem('myvibe_user');
    window.location.reload();
}

// ===================== CHANGEMENT MDP OBLIGATOIRE =====================

function afficherModaleChangementMdpObligatoire(userId) {
    document.getElementById('login-page').style.display = 'none';
    document.body.style.background = '#f3f4f6';
    document.body.style.alignItems = 'stretch';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = '🔑 Changement de mot de passe requis';
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
    // Bloquer la fermeture de la modale
    document.getElementById('overlay').onclick = null;
    document.querySelector('.mclos').style.display = 'none';
}

async function validerChangementMdpObligatoire(userId) {
    const ancien  = document.getElementById('force-mdp-ancien').value;
    const nouveau = document.getElementById('force-mdp-nouveau').value;
    const confirm = document.getElementById('force-mdp-confirm').value;
    const msg     = document.getElementById('force-mdp-msg');
    if (nouveau !== confirm) {
        msg.style.color = '#ef4444';
        msg.textContent = '❌ Les mots de passe ne correspondent pas';
        return;
    }
    try {
        const r = await fetch('/api/profil/changer-mdp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.style.color = '#10b981';
            msg.textContent = '✅ Mot de passe changé !';
            document.querySelector('.mclos').style.display = '';
            document.getElementById('overlay').onclick = closeOutside;
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

// ===================== DATES & VERSION =====================

function afficherDate() {
    const now = new Date();
    document.getElementById('date-display').textContent =
        now.toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

async function afficherVersion() {
    try {
        const r = await fetch('/sw.js');
        const txt = await r.text();
        const match = txt.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
            const el = document.querySelector('.footer');
            if (el) el.innerHTML += ` <span style="font-size:10px;opacity:0.4;margin-left:8px">${match[1]}</span>`;
        }
    } catch(e) {}
}

// ===================== BUILD GRID =====================

async function buildGrid() {
    const user  = JSON.parse(localStorage.getItem('myvibe_user'));
    const grid  = document.getElementById('main-grid');
    grid.innerHTML = '';

    let ordre = null;
    try {
        const r = await fetch(`/api/widget-order?userId=${user.userId}`);
        const d = await r.json();
        if (d.success && Array.isArray(d.order) && d.order.length) ordre = d.order;
    } catch(e) {}

    const widgetsDispo = WIDGETS_DEF.filter(w => {
        if (w.adminOnly && user?.role !== 'admin') return false;
        return true;
    });

    let liste;
    if (ordre) {
        liste = ordre
            .map(id => widgetsDispo.find(w => w.id === id))
            .filter(Boolean);
        widgetsDispo.forEach(w => {
            if (!liste.find(l => l.id === w.id)) liste.push(w);
        });
    } else {
        liste = widgetsDispo;
    }

    liste.forEach(w => grid.appendChild(creerWidget(w)));
    initDragAndDrop();
}

function creerWidget(w) {
    const div = document.createElement('div');
    div.className = `widget ${w.cls}`;
    div.dataset.id = w.id;
    div.draggable  = true;

    let headerExtra = '';
    if (w.refresh) {
        headerExtra = `<button class="widget-refresh" onclick="event.stopPropagation();refreshWidget('${w.id}')" title="Actualiser">&#8635;</button>`;
    }

    if (w.id === 'admin') {
        div.innerHTML = `
            <div class="widget-header">
                <span class="widget-icon">${w.icon}</span>
                <h3>${w.label}</h3>
            </div>
            <div id="widget-admin-content">
                <div class="wa-loading">Chargement...</div>
            </div>
        `;
        div.addEventListener('click', e => {
            if (!e.target.closest('button') && !dragActif) ouvrirAdmin();
        });
        return div;
    }

    if (w.id === 'profil') {
        div.innerHTML = `
            <div class="widget-header">
                <span class="widget-icon">${w.icon}</span>
                <h3>${w.label}</h3>
                ${headerExtra}
            </div>
            <div id="widget-profil-body"></div>
        `;
        div.addEventListener('click', e => {
            if (!e.target.closest('button') && !dragActif) openModal('profil');
        });
        return div;
    }

    if (w.id === 'planning') {
        div.innerHTML = `
            <div class="widget-header">
                <span class="widget-icon">${w.icon}</span>
                <h3>${w.label}</h3>
            </div>
            <div id="widget-planning-contenu">
                <p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Chargement...</p>
            </div>
        `;
        div.addEventListener('click', e => {
            if (!e.target.closest('button') && !dragActif) openModal('planning');
        });
        return div;
    }

    div.innerHTML = `
        <div class="widget-header">
            <span class="widget-icon">${w.icon}</span>
            <h3>${w.label}</h3>
            ${headerExtra}
        </div>
        <div id="widget-${w.id}-body">
            ${w.desc ? `<p class="widget-desc">${w.desc}</p>` : ''}
        </div>
        ${w.foot ? `<div class="widget-foot">${w.foot}</div>` : ''}
    `;
    return div;
}

function refreshWidget(id) {
    switch(id) {
        case 'meteo':      chargerMeteoAuto();                                          break;
        case 'priere':     chargerPriere();                                             break;
        case 'cycle':      if (typeof Cycle !== 'undefined') Cycle.charger();           break;
        case 'rendezvous': if (typeof Rendezvous !== 'undefined') Rendezvous.charger(); break;
        case 'planning':   chargerWidgetPlanning();                                     break;
    }
}

// ===================== DRAG & DROP =====================

function initDragAndDrop() {
    const widgets = document.querySelectorAll('.widget');
    widgets.forEach(w => {
        w.addEventListener('dragstart',  onDragStart);
        w.addEventListener('dragover',   onDragOver);
        w.addEventListener('drop',       onDrop);
        w.addEventListener('dragend',    onDragEnd);
        w.addEventListener('touchstart', onTouchStart, { passive:true });
        w.addEventListener('touchmove',  onTouchMove,  { passive:false });
        w.addEventListener('touchend',   onTouchEnd);
    });
}

function onDragStart(e) {
    dragSrc = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function onDrop(e) {
    e.stopPropagation();
    if (dragSrc !== this) {
        const grid    = document.getElementById('main-grid');
        const widgets = [...grid.querySelectorAll('.widget')];
        const fromIdx = widgets.indexOf(dragSrc);
        const toIdx   = widgets.indexOf(this);
        if (fromIdx < toIdx) grid.insertBefore(dragSrc, this.nextSibling);
        else                 grid.insertBefore(dragSrc, this);
        sauvegarderOrdre();
    }
    return false;
}

function onDragEnd() {
    document.querySelectorAll('.widget').forEach(w => w.classList.remove('dragging'));
    dragSrc = null;
}

let touchWidget = null;
let touchClone  = null;
let touchOffX   = 0;
let touchOffY   = 0;

function onTouchStart(e) {
    longPressTimer = setTimeout(() => {
        dragActif   = true;
        touchWidget = this;
        const rect  = this.getBoundingClientRect();
        const touch = e.touches[0];
        touchOffX   = touch.clientX - rect.left;
        touchOffY   = touch.clientY - rect.top;
        touchClone  = this.cloneNode(true);
        touchClone.style.cssText = `
            position:fixed;width:${rect.width}px;opacity:0.85;pointer-events:none;
            z-index:9999;left:${rect.left}px;top:${rect.top}px;
            box-shadow:0 8px 30px rgba(0,0,0,.2);transform:scale(1.03);transition:none;
        `;
        document.body.appendChild(touchClone);
        this.style.opacity = '0.3';
    }, 500);
}

function onTouchMove(e) {
    clearTimeout(longPressTimer);
    if (!dragActif || !touchClone) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchClone.style.left = (touch.clientX - touchOffX) + 'px';
    touchClone.style.top  = (touch.clientY - touchOffY) + 'px';
}

function onTouchEnd(e) {
    clearTimeout(longPressTimer);
    if (!dragActif || !touchWidget || !touchClone) { dragActif = false; return; }
    const touch  = e.changedTouches[0];
    touchClone.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchClone.style.display = '';
    const target = el?.closest('.widget');
    if (target && target !== touchWidget) {
        const grid    = document.getElementById('main-grid');
        const widgets = [...grid.querySelectorAll('.widget')];
        const fromIdx = widgets.indexOf(touchWidget);
        const toIdx   = widgets.indexOf(target);
        if (fromIdx < toIdx) grid.insertBefore(touchWidget, target.nextSibling);
        else                 grid.insertBefore(touchWidget, target);
        sauvegarderOrdre();
    }
    touchWidget.style.opacity = '';
    touchClone.remove();
    touchClone  = null;
    touchWidget = null;
    dragActif   = false;
}

async function sauvegarderOrdre() {
    const user    = JSON.parse(localStorage.getItem('myvibe_user'));
    const widgets = [...document.querySelectorAll('.widget')];
    const ordre   = widgets.map(w => w.dataset.id);
    try {
        await fetch('/api/widget-order', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ userId: user.userId, ordre })
        });
    } catch(e) {}
}

// ===================== PROFIL HEADER =====================

async function chargerProfilHeader() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const btn  = document.getElementById('btn-profil-header');
    if (!btn) return;
    try {
        const r = await fetch(`/api/profil?userId=${user.userId}`);
        const d = await r.json();
        if (d.success && d.profil?.photo_url) {
            btn.innerHTML = `<img src="${d.profil.photo_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #fff">`;
        }
    } catch(e) {}
}

// ===================== SERVICE WORKER & PUSH =====================

function enregistrerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}
