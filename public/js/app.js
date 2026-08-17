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
    { id:'planning',      label:'Planning',          icon:'📋',  cls:'w-planning',      desc:'Pas de garde aujourd\'hui',   foot:'' },
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
        showApp();
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
    setTimeout(() => chargerWidgetTaches(), 300);
    chargerWidgetAnniversaires();
    chargerWidgetPlanning();
    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();

    // Widget admin : uniquement si role admin
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
    chargerWidgetTaches();
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

    // Filtre les widgets selon le rôle
    const widgetsDispo = WIDGETS_DEF.filter(w => {
        if (w.adminOnly && user?.role !== 'admin') return false;
        return true;
    });

    let liste;
    if (ordre) {
        // Respecte l'ordre sauvegardé, ignore les widgets non dispo
        liste = ordre
            .map(id => widgetsDispo.find(w => w.id === id))
            .filter(Boolean);
        // Ajoute les nouveaux widgets non encore dans l'ordre sauvegardé
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
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const div  = document.createElement('div');
    div.className = `widget ${w.cls}`;
    div.dataset.id = w.id;
    div.draggable  = true;

    let headerExtra = '';
    if (w.refresh) {
        headerExtra = `<button class="widget-refresh" onclick="refreshWidget('${w.id}')" title="Actualiser">&#8635;</button>`;
    }

    // Contenu spécifique selon le widget
    let body = '';
    if (w.id === 'admin') {
        body = `
            <div class="widget-header">
                <span class="widget-icon">${w.icon}</span>
                <h3>${w.label}</h3>
            </div>
            <div id="widget-admin-content">
                <div class="wa-loading">Chargement...</div>
            </div>
        `;
    } else if (w.id === 'profil') {
        body = `
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
    } else {
        body = `
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
    }

    div.innerHTML = body;
    return div;
}

function refreshWidget(id) {
    switch(id) {
        case 'meteo':      chargerMeteoAuto();                                        break;
        case 'priere':     chargerPriere();                                           break;
        case 'cycle':      if (typeof Cycle !== 'undefined') Cycle.charger();         break;
        case 'rendezvous': if (typeof Rendezvous !== 'undefined') Rendezvous.charger(); break;
        case 'planning':   chargerWidgetPlanning();                                   break;
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

// Touch drag
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
