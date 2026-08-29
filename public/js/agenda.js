// ============================================================
// public/js/agenda.js
// Widget Agenda unifié — Planning + RDV triés par date.
// GET /api/agenda — affiche aujourd'hui + jours avec événements.
// Priorité : Travail/Mission/Congé > Repos (Repos masqué si autre présent).
// Repos seul : masqué sauf aujourd'hui.
// Clic widget → modale Planning + RDV fusionnés.
// ============================================================

const AGENDA_SHIFT_CONFIG = {
    'Travail'    : { emoji: '🏥', couleur: '#f4a261' },
    'Repos'      : { emoji: '💤', couleur: '#90caf9' },
    'Congé payé' : { emoji: '🏖️', couleur: '#80cbc4' },
    'Mission'    : { emoji: '💼', couleur: '#ce93d8' },
    'Autre'      : { emoji: '📋', couleur: '#bcaaa4' },
};

const AGENDA_TYPE_ICONS = {
    'Généraliste'      : '🩺',
    'Gynécologue'      : '🌸',
    'Dentiste'         : '🦷',
    'Ophtalmologue'    : '👁️',
    'Dermatologue'     : '💊',
    'Kinésithérapeute' : '🤸',
    'Urgences'         : '🚨',
    'Autre'            : '📋'
};

const AGENDA_JOURS    = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const AGENDA_MOIS     = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const AGENDA_PRIORITE = ['Travail', 'Mission', 'Congé payé'];

function _agendaLabelDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const obj       = new Date(y, m - 1, d);
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((obj - today) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    return `${AGENDA_JOURS[obj.getDay()]} ${d} ${AGENDA_MOIS[m - 1]}`;
}

function _agendaRenderItem(item) {
    let emoji   = '📅';
    let couleur = '#e5e7eb';

    if (item.type === 'planning') {
        const cfg = AGENDA_SHIFT_CONFIG[item.categorie] || AGENDA_SHIFT_CONFIG['Autre'];
        emoji   = cfg.emoji;
        couleur = cfg.couleur;
    } else if (item.type === 'rdv') {
        emoji   = AGENDA_TYPE_ICONS[item.categorie] || '📋';
        couleur = '#a5b4fc';
    }

    return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                    margin-bottom:4px;border-left:4px solid ${couleur};
                    background:${couleur}22;border-radius:8px">
            <span style="font-size:20px;flex-shrink:0">${emoji}</span>
            <div style="min-width:0;flex:1">
                <div style="font-size:14px;font-weight:700;color:#1f2937;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${item.titre}
                </div>
                ${item.heure
                    ? `<div style="font-size:12px;color:#6b7280">⏰ ${item.heure}</div>`
                    : ''}
                ${item.sous_titre
                    ? `<div style="font-size:11px;color:#9ca3af">${item.sous_titre}</div>`
                    : ''}
            </div>
        </div>`;
}

// Filtre les items d'un jour :
// - Supprime les tâches
// - Si Travail/Mission/Congé présent → masque Repos
// - Retourne null si uniquement Repos (pour masquer le jour)
function _agendaFiltrerJour(items, estAujourdhui) {
    // Supprimer les tâches
    let filtres = items.filter(i => i.type !== 'tache');

    // Si vide → null
    if (!filtres.length) return estAujourdhui ? [] : null;

    // Si prioritaire présent → masquer Repos
    const hasPriorite = filtres.some(
        i => i.type === 'planning' && AGENDA_PRIORITE.includes(i.categorie)
    );
    if (hasPriorite) {
        filtres = filtres.filter(
            i => !(i.type === 'planning' && i.categorie === 'Repos')
        );
    }

    // Si uniquement Repos et pas aujourd'hui → masquer le jour
    const tousRepos = filtres.length > 0 && filtres.every(
        i => i.type === 'planning' && i.categorie === 'Repos'
    );
    if (tousRepos && !estAujourdhui) return null;

    return filtres;
}

async function chargerAgendaUnifie() {
    const el = document.getElementById('wc-agenda-unifie');
    if (!el) return;

    const user = getUser();
    if (!user?.token) {
        el.innerHTML = '<p style="color:#888;text-align:center;font-size:13px">Non connecté</p>';
        return;
    }

    try {
        const r = await fetch('/api/agenda', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Grouper par date
        const parDate = {};
        if (d.success && d.items.length) {
            d.items.forEach(item => {
                if (!parDate[item.date]) parDate[item.date] = [];
                parDate[item.date].push(item);
            });
        }

        // Toujours inclure aujourd'hui même si vide
        if (!parDate[todayStr]) parDate[todayStr] = [];

        const datesTrie = Object.keys(parDate).sort();

        let html = '';
        datesTrie.forEach(date => {
            const estAujourdhui  = date === todayStr;
            const itemsFiltres   = _agendaFiltrerJour(parDate[date], estAujourdhui);

            // null = jour masqué
            if (itemsFiltres === null) return;

            html += `
                <div style="font-size:11px;font-weight:700;color:#7c3aed;
                            text-transform:uppercase;letter-spacing:.5px;
                            margin:10px 0 4px">
                    ${_agendaLabelDate(date)}
                </div>`;

            if (itemsFiltres.length === 0) {
                html += `<div style="font-size:13px;color:#9ca3af;
                                     padding:6px 10px;font-style:italic">
                             Aucun événement
                         </div>`;
            } else {
                itemsFiltres.forEach(item => { html += _agendaRenderItem(item); });
            }
        });

        el.innerHTML = html || '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:12px">Aucun événement à venir</p>';

    } catch {
        el.innerHTML = '<p style="color:#888;text-align:center;font-size:13px">Erreur de chargement</p>';
    }
}

// ── Modale Agenda — Planning + RDV fusionnés ──────────────────
async function ouvrirModaleAgenda() {
    const body = document.getElementById('modal-body');
    if (!body) return;

    body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:16px">
            <button onclick="_agendaOuvrirPlanning()"
                style="flex:1;padding:11px;background:linear-gradient(135deg,#f4a261,#e76f51);
                       color:white;border:none;border-radius:10px;font-size:14px;
                       font-weight:600;cursor:pointer">
                📋 Planning
            </button>
            <button onclick="_agendaOuvrirRdv()"
                style="flex:1;padding:11px;background:linear-gradient(135deg,#a5b4fc,#818cf8);
                       color:white;border:none;border-radius:10px;font-size:14px;
                       font-weight:600;cursor:pointer">
                🩺 Rendez-vous
            </button>
        </div>
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:8px">Prochains événements</div>
        <div id="agenda-modale-liste">
            <p style="color:#9ca3af;text-align:center;font-size:13px;padding:12px">Chargement...</p>
        </div>
    `;

    const user = getUser();
    if (!user?.token) return;

    try {
        const r = await fetch('/api/agenda', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d    = await r.json();
        const liste = document.getElementById('agenda-modale-liste');
        if (!liste) return;

        if (!d.success || !d.items.length) {
            liste.innerHTML = '<p style="color:#9ca3af;text-align:center;font-size:13px">Aucun événement à venir</p>';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const parDate = {};
        d.items.forEach(item => {
            if (item.type === 'tache') return; // pas de tâches
            if (!parDate[item.date]) parDate[item.date] = [];
            parDate[item.date].push(item);
        });

        if (!parDate[todayStr]) parDate[todayStr] = [];

        let html = '';
        Object.keys(parDate).sort().forEach(date => {
            const estAujourdhui = date === todayStr;
            const items         = _agendaFiltrerJour(parDate[date], estAujourdhui);
            if (items === null) return;

            html += `
                <div style="font-size:11px;font-weight:700;color:#7c3aed;
                            text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px">
                    ${_agendaLabelDate(date)}
                </div>`;

            if (items.length === 0) {
                html += `<div style="font-size:13px;color:#9ca3af;padding:6px 10px;font-style:italic">Aucun événement</div>`;
            } else {
                items.forEach(item => { html += _agendaRenderItem(item); });
            }
        });

        liste.innerHTML = html || '<p style="color:#9ca3af;text-align:center;font-size:13px">Aucun événement</p>';

    } catch {
        const liste = document.getElementById('agenda-modale-liste');
        if (liste) liste.innerHTML = '<p style="color:#888;text-align:center;font-size:13px">Erreur de chargement</p>';
    }
}

function _agendaOuvrirPlanning() {
    document.getElementById('modal-title').textContent = 'Mon Planning';
    document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';
    if (typeof ouvrirPlanningModal === 'function') ouvrirPlanningModal();
}

function _agendaOuvrirRdv() {
    document.getElementById('modal-title').textContent = 'Rendez-vous médicaux';
    document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';
    if (typeof Rendezvous !== 'undefined') Rendezvous.ouvrirListe();
}
