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
    { id:'meteo',         label:'Météo du jour',    icon:'🌤️', cls:'w-meteo',         desc:'Chargement...',                      foot:'Cliquez pour les détails',       refresh:true },
    { id:'priere',        label:'Prière du jour',   icon:'🙏',  cls:'w-priere',        desc:'Chargement...',                      foot:'Cliquez pour la version complète',refresh:true },
    { id:'taches',        label:'Tâches du jour',   icon:'✅',  cls:'w-taches',        desc:'Chargement...',                      foot:'Cliquez pour gérer' },
    { id:'cycle',         label:'Suivi du cycle',   icon:'🌸',  cls:'w-cycle',         desc:'Chargement...',                      foot:'Cycle féminin & fertilité',      refresh:true },
    { id:'rendezvous',    label:'Rendez-vous',      icon:'🩺',  cls:'w-rdv',           desc:'Chargement...',                      foot:'Consultations & santé',          refresh:true },
    { id:'planning',      label:'Planning',          icon:'📋',  cls:'w-planning',      desc:'Pas de garde aujourd\'hui',          foot:'Cliquez pour voir le planning' },
    { id:'anniversaires', label:'Anniversaires',     icon:'🎂',  cls:'w-anniversaires', desc:'Chargement...',                      foot:'Cliquez pour gérer' },
    { id:'mails',         label:'Mails',             icon:'📧',  cls:'w-mails',         desc:'Bientôt disponible',                 foot:'Cliquez pour consulter' },
    { id:'profil',        label:'Mon Profil',        icon:'👤',  cls:'w-profil',        desc:'Cliquez pour modifier votre profil', foot:'Modifier' },
];

const codes = {
    0:'Ciel dégagé ☀️',1:'Principalement dégagé 🌤️',2:'Partiellement nuageux ⛅',
    3:'Couvert ☁️',45:'Brouillard 🌫️',48:'Brouillard givrant 🌫️',
    51:'Bruine légère 🌦️',61:'Pluie légère 🌧️',63:'Pluie modérée 🌧️',
    65:'Forte pluie 🌧️',71:'Neige légère 🌨️',80:'Averses 🌦️',
    95:'Orage ⛈️',99:'Orage avec grêle ⛈️'
};

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('myvibe_user')) showApp();
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
            role    : d.role,
            userId  : d.userId,
            token   : d.token
        }));
        showApp();
    } else {
        document.getElementById('error-msg').textContent = d.message;
    }
});

async function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.body.style.background = '#f3f4f6';
    document.body.style.alignItems = 'stretch';
    document.getElementById('app').style.display = 'flex';
    afficherDate();
    await buildGrid();
    chargerPriere();
    chargerMeteoAuto();
    chargerProfilHeader();
    chargerWidgetTaches();
    chargerWidgetAnniversaires();
    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();
    enregistrerServiceWorker();
}

function actualiser() {
    afficherDate();
    chargerPriere();
    chargerMeteoAuto();
    chargerProfilHeader();
    chargerWidgetTaches();
    chargerWidgetAnniversaires();
    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();
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
