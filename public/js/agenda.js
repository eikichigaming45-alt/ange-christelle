// ============================================================
// public/js/agenda.js
// Widget Agenda unifié — Planning + RDV triés par date.
// GET /api/agenda
// Règles de priorité :
//   - Repos seul        → masqué (sauf aujourd'hui)
//   - Repos + autre     → Repos masqué, autre affiché
//   - Congé + autre     → Congé masqué, autre affiché
//   - Travail + autre   → les deux affichés
//   - Mission + autre   → les deux affichés
// Modal : vue chronologique unifiée, sans onglets Planning/RDV.
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

const AGENDA_JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const AGENDA_MOIS  = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];

// Catégories planning qui s'effacent si un RDV ou une tâche existe le même jour
const AGENDA_MASQUABLES = ['Repos', 'Congé payé'];
// Catégories planning qui coexistent avec tout le reste
const AGENDA_COEXISTANTS = ['Travail', 'Mission'];

function _agendaLabelDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const obj       = new Date(y, m - 1, d);
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((obj - today) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Demain';
    const jourNom = AGENDA_JOURS[obj.getDay()];
    const moisNom = AGENDA_MOIS[m - 1];
    return `${jourNom} ${d} ${moisNom}`;
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
    } else if (item.type === 'tache') {
        emoji   = '✅';
        couleur = '#fcd34d';
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

// ── Logique de filtrage par jour ──────────────────────────────
// Règles :
//   1. Si le jour n'a que des items "masquables" (Repos/Congé) → null sauf aujourd'hui
//   2. Si des RDV ou tâches existent → supprimer les masquables, garder Travail/Mission
//   3. Travail/Mission coexistent toujours avec le reste
function _agendaFiltrerJour(items, estAujourdhui) {
    if (!items.length) return estAujourdhui ? [] : null;

    const hasNonPlanning = items.some(i => i.type === 'rdv' || i.type === 'tache');
    const hasMasquable   = items.some(i => i.type === 'planning' && AGENDA_MASQUABLES.includes(i.categorie));
    const hasCoexistant  = items.some(i => i.type === 'planning' && AGENDA_COEXISTANTS.includes(i.categorie));

    let filtres = [...items];

    // Si RDV ou tâche présent → supprimer les masquables (Repos, Congé)
    if (hasNonPlanning && hasMasquable) {
        filtres = filtres.filter(
            i => !(i.type === 'planning' && AGENDA_MASQUABLES.includes(i.categorie))
        );
    }

    // Si uniquement masquables restants et pas aujourd'hui → masquer le jour
    const toutMasquable = filtres.length > 0 && filtres.every(
        i => i.type === 'planning' && AGENDA_MASQUABLES.includes(i.categorie)
    );
    if (toutMasquable && !estAujourdhui) return null;

    return filtres;
}

// ── Chargement du widget (onglet Quotidien) ───────────────────
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

        // Toujours inclure aujourd'hui
        if (!parDate[todayStr]) parDate[todayStr] = [];

        const datesTrie = Object.keys(parDate).sort();

        let html = '';
        datesTrie.forEach(date => {
            const estAujourdhui = date === todayStr;
            const itemsFiltres  = _agendaFiltrerJour(parDate[date], estAujourdhui);

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

// ── Modale Agenda — vue chronologique unifiée ─────────────────
async function ouvrirModaleAgenda() {
    const body = document.getElementById('modal-body');
    if (!body) return;

    body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    const user = getUser();
    if (!user?.token) {
        body.innerHTML = '<p style="color:#888;text-align:center">Non connecté</p>';
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

        const parDate = {};
        if (d.success && d.items.length) {
            d.items.forEach(item => {
                if (!parDate[item.date]) parDate[item.date] = [];
                parDate[item.date].push(item);
            });
        }

        if (!parDate[todayStr]) parDate[todayStr] = [];

        let html = '';
        Object.keys(parDate).sort().forEach(date => {
            const estAujourdhui = date === todayStr;
            const items         = _agendaFiltrerJour(parDate[date], estAujourdhui);
            if (items === null) return;

            html += `
                <div style="font-size:11px;font-weight:700;color:#7c3aed;
                            text-transform:uppercase;letter-spacing:.5px;
                            margin:12px 0 6px">
                    ${_agendaLabelDate(date)}
                </div>`;

            if (items.length === 0) {
                html += `<div style="font-size:13px;color:#9ca3af;padding:6px 10px;font-style:italic">Aucun événement</div>`;
            } else {
                items.forEach(item => { html += _agendaRenderItem(item); });
            }
        });

        body.innerHTML = html || '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:20px">Aucun événement à venir</p>';

    } catch {
        body.innerHTML = '<p style="color:#888;text-align:center;font-size:13px">Erreur de chargement</p>';
    }
}
