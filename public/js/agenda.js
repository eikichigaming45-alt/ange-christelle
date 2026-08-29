// ============================================================
// public/js/agenda.js
// Widget Agenda unifié — Planning + RDV + Tâches triés par date.
// GET /api/agenda — 7 jours glissants.
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
    } else if (item.type === 'tache') {
        emoji   = '✅';
        couleur = '#6ee7b7';
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

        if (!d.success || !d.items.length) {
            el.innerHTML = '<p style="color:#9ca3af;text-align:center;font-size:13px;padding:12px">Aucun événement dans les 7 prochains jours</p>';
            return;
        }

        const parDate = {};
        d.items.forEach(item => {
            if (!parDate[item.date]) parDate[item.date] = [];
            parDate[item.date].push(item);
        });

        let html = '';
        Object.entries(parDate).forEach(([date, items]) => {
            html += `
                <div style="font-size:11px;font-weight:700;color:#7c3aed;
                            text-transform:uppercase;letter-spacing:.5px;
                            margin:10px 0 4px">
                    ${_agendaLabelDate(date)}
                </div>`;
            items.forEach(item => { html += _agendaRenderItem(item); });
        });

        el.innerHTML = html;

    } catch {
        el.innerHTML = '<p style="color:#888;text-align:center;font-size:13px">Erreur de chargement</p>';
    }
}
