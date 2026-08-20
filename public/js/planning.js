// ============================================================
// public/js/planning.js — v3.50
// Planning mensuel + widget 5 jours + gestion employeurs.
// Nouveau modèle métier : Travail, Repos, Congé payé, Mission, Autre.
// Congé payé : plage date_debut → date_fin.
// Autre      : libelle_personnalise affiché à la place de "Autre".
// Suppression : message personnalisé catégorie + date.
// ============================================================

const SHIFT_CONFIG = {
    'Travail'    : { emoji: '🏥', couleur: '#f4a261' },
    'Repos'      : { emoji: '💤', couleur: '#90caf9' },
    'Congé payé' : { emoji: '🏖️', couleur: '#80cbc4' },
    'Mission'    : { emoji: '💼', couleur: '#ce93d8' },
    'Autre'      : { emoji: '📋', couleur: '#bcaaa4' },
};

const JOURS_PLANNING = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS_PLANNING  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_COURT     = ['jan','fév','mar','avr','mai','juin',
                        'juil','août','sep','oct','nov','déc'];

const CATS_PRIORITE = ['Mission', 'Travail'];

function _planningAuth() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return { user, token: user?.token };
}

function _labelEntree(e) {
    if (e.categorie === 'Autre' && e.libelle_personnalise) return e.libelle_personnalise;
    return e.categorie || e.type || '?';
}

function _configEntree(e) {
    return SHIFT_CONFIG[e.categorie] || SHIFT_CONFIG[e.type] || { emoji: '📋', couleur: '#eee' };
}

async function _fetchPlanningMois(annee, mois, token) {
    const res = await fetch(`/api/planning?annee=${annee}&mois=${mois}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache  : 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data))          return data;
    if (Array.isArray(data.planning)) return data.planning;
    return [];
}

function _optionsRappel(selected = 0) {
    const opts = [
        { v: 0,    l: 'Pas de rappel' },
        { v: 15,   l: '15 min avant'  },
        { v: 30,   l: '30 min avant'  },
        { v: 60,   l: '1h avant'      },
        { v: 120,  l: '2h avant'      },
        { v: 1440, l: 'La veille'     },
    ];
    return opts.map(o =>
        `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${o.l}</option>`
    ).join('');
}

async function _fetchEmployeurs(token) {
    try {
        const res  = await fetch('/api/planning/employeurs', {
            headers: { Authorization: `Bearer ${token}` },
            cache  : 'no-store'
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const liste = Array.isArray(data) ? data
                    : Array.isArray(data.employeurs) ? data.employeurs
                    : [];
        return liste.map(e => (typeof e === 'string' ? e : e.nom)).filter(Boolean);
    } catch { return []; }
}

function _entriesForDate(entries, dateStr) {
    return entries.filter(e => {
        const debut = e.date_debut_str || e.date_str || e.date?.slice(0, 10);
        const fin   = e.date_fin_str   || null;
        if (!debut) return false;
        if (fin) return dateStr >= debut && dateStr <= fin;
        return debut === dateStr;
    });
}

// ══════════════════════════════════════════════════════════════════════════
// WIDGET — 5 jours glissants
// ══════════════════════════════════════════════════════════════════════════

async function chargerWidgetPlanning() {
    const conteneur = document.getElementById('widget-planning-contenu');
    if (!conteneur) return;
    const { token } = _planningAuth();
    if (!token) return;

    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, '0');
        const dd   = String(d.getDate()).padStart(2, '0');
        dates.push({ obj: d, str: `${yyyy}-${mm}-${dd}` });
    }

    let entries = [];
    try {
        const now = new Date();
        entries = await _fetchPlanningMois(now.getFullYear(), now.getMonth() + 1, token);
        const dernier = dates[4].obj;
        if (dernier.getMonth() !== now.getMonth()) {
            const suite = await _fetchPlanningMois(
                dernier.getFullYear(), dernier.getMonth() + 1, token
            );
            entries = entries.concat(suite);
        }
    } catch {
        conteneur.innerHTML = '<p style="color:#999;font-size:13px">Erreur de chargement</p>';
        return;
    }

    let html = '';
    dates.forEach(({ obj, str }, i) => {
        const entriesJour = _entriesForDate(entries, str);
        const nomJour     = JOURS_PLANNING[obj.getDay()];
        const label       = i === 0 ? "Aujourd'hui"
                                    : `${nomJour} ${obj.getDate()} ${MOIS_COURT[obj.getMonth()]}`;

        if (entriesJour.length > 0) {
            const hasPriorite = entriesJour.some(e => CATS_PRIORITE.includes(e.categorie));
            const aAfficher   = hasPriorite
                ? entriesJour.filter(e => CATS_PRIORITE.includes(e.categorie))
                : entriesJour;

            aAfficher.forEach((entry, idx) => {
                const s           = _configEntree(entry);
                const label_entry = _labelEntree(entry);
                html += `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                                margin-bottom:${idx === aAfficher.length - 1 ? '6px' : '2px'};
                                background:${s.couleur}22;border-left:4px solid ${s.couleur};border-radius:8px">
                        <span style="font-size:20px">${s.emoji}</span>
                        <div>
                            ${idx === 0 ? `<div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</div>` : ''}
                            <div style="font-size:14px;font-weight:700;color:#333">${label_entry}</div>
                            ${entry.heure_debut ? `<div style="font-size:12px;color:#666">⏰ ${entry.heure_debut.slice(0,5)} → ${(entry.heure_fin||'').slice(0,5)||'?'}</div>` : ''}
                            ${entry.employeur   ? `<div style="font-size:11px;color:#999">🏥 ${entry.employeur}</div>` : ''}
                        </div>
                    </div>`;
            });
        } else {
            html += `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;
                            background:#f9f9f9;border-left:4px solid #ddd;border-radius:8px">
                    <span style="font-size:20px">📅</span>
                    <div>
                        <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</div>
                        <div style="font-size:13px;color:#bbb">Aucune entrée</div>
                    </div>
                </div>`;
        }
    });

    conteneur.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL CALENDRIER MENSUEL
// ══════════════════════════════════════════════════════════════════════════

let _planningMoisActuel  = new Date().getMonth();
let _planningAnneeActuel = new Date().getFullYear();
let _planningEntries     = [];

async function ouvrirPlanningModal() {
    _planningMoisActuel  = new Date().getMonth();
    _planningAnneeActuel = new Date().getFullYear();
    document.getElementById('modal-title').textContent = 'Planning';
    await _afficherCalendrierPlanning();
}

async function _afficherCalendrierPlanning() {
    const body = document.getElementById('modal-body');
    if (!body) return;
    body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    const { token } = _planningAuth();
    if (!token) { body.innerHTML = '<p>Non authentifié.</p>'; return; }

    try {
        _planningEntries = await _fetchPlanningMois(_planningAnneeActuel, _planningMoisActuel + 1, token);
    } catch {
        body.innerHTML = '<p style="color:#ef4444">Erreur de chargement.</p>';
        return;
    }

    const today       = new Date();
    const premierJour = new Date(_planningAnneeActuel, _planningMoisActuel, 1).getDay();
    const nbJours     = new Date(_planningAnneeActuel, _planningMoisActuel + 1, 0).getDate();
    const offset      = premierJour === 0 ? 6 : premierJour - 1;

    const legendeHTML = Object.entries(SHIFT_CONFIG).map(([cat, s]) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;
                      background:${s.couleur}33;border-radius:20px;font-size:12px;font-weight:600;
                      margin:2px;border:1px solid ${s.couleur}66">
             ${s.emoji} ${cat === 'Autre' ? 'Autre / Libre' : cat}
         </span>`
    ).join('');

    let cellules = '';
    for (let i = 0; i < offset; i++) {
        cellules += `<div style="aspect-ratio:1;min-height:44px"></div>`;
    }

    for (let j = 1; j <= nbJours; j++) {
        const dateStr     = `${_planningAnneeActuel}-${String(_planningMoisActuel + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
        const isToday     = j === today.getDate()
                         && _planningMoisActuel === today.getMonth()
                         && _planningAnneeActuel === today.getFullYear();
        const entriesJour = _entriesForDate(_planningEntries, dateStr);
        const hasPriorite = entriesJour.some(e => CATS_PRIORITE.includes(e.categorie));
        const e0          = hasPriorite
            ? entriesJour.find(e => CATS_PRIORITE.includes(e.categorie))
            : entriesJour[0];
        const s           = e0 ? _configEntree(e0) : null;
        const autresCount = entriesJour.length - 1;
        const plus        = autresCount > 0
            ? `<div style="font-size:9px;color:#666">+${autresCount}</div>`
            : '';

        cellules += `
            <div onclick="_ouvrirDetailJourPlanning(${j})" style="
                aspect-ratio:1;min-height:44px;border-radius:10px;cursor:pointer;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                background:${s ? s.couleur + '33' : '#f9fafb'};
                border:2px solid ${isToday ? '#4f46e5' : (s ? s.couleur + '99' : '#e5e7eb')};
                font-size:12px;font-weight:600;color:#333;transition:opacity .15s">
                <div style="font-size:11px;font-weight:700;color:${isToday ? '#4f46e5' : '#444'}">${j}</div>
                ${s ? `<div style="font-size:16px;line-height:1">${s.emoji}</div>` : ''}
                ${plus}
            </div>`;
    }

    body.innerHTML = `
        <div style="font-family:inherit">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <button onclick="_planningMoisPrec()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 10px;border-radius:8px">‹</button>
                <div style="font-weight:700;font-size:16px;color:#1f2937">
                    ${MOIS_PLANNING[_planningMoisActuel]} ${_planningAnneeActuel}
                </div>
                <button onclick="_planningMoisSuiv()" style="background:none;border:none;font-size:22px;cursor:pointer;padding:4px 10px;border-radius:8px">›</button>
            </div>
            <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:2px">${legendeHTML}</div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
                ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j =>
                    `<div style="text-align:center;font-size:11px;font-weight:700;color:#9ca3af;padding:4px 0">${j}</div>`
                ).join('')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px">
                ${cellules}
            </div>
            <button onclick="_ouvrirGestionEmployeurs()" style="
                width:100%;padding:11px;margin-bottom:8px;
                background:#f3f4f6;color:#374151;
                border:none;border-radius:12px;
                font-size:14px;font-weight:600;cursor:pointer">
                🏥 Gérer mes employeurs
            </button>
            <button onclick="_ouvrirFormulaireEntreePlanning(null)" style="
                width:100%;padding:13px;
                background:linear-gradient(135deg,#4f46e5,#7c3aed);
                color:white;border:none;border-radius:12px;
                font-size:15px;font-weight:600;cursor:pointer;
                box-shadow:0 4px 12px rgba(79,70,229,.3)">
                + Ajouter une entrée
            </button>
        </div>`;
}

async function _planningMoisPrec() {
    _planningMoisActuel--;
    if (_planningMoisActuel < 0) { _planningMoisActuel = 11; _planningAnneeActuel--; }
    await _afficherCalendrierPlanning();
}

async function _planningMoisSuiv() {
    _planningMoisActuel++;
    if (_planningMoisActuel > 11) { _planningMoisActuel = 0; _planningAnneeActuel++; }
    await _afficherCalendrierPlanning();
}

function _ouvrirDetailJourPlanning(jour) {
    const body      = document.getElementById('modal-body');
    const dateStr   = `${_planningAnneeActuel}-${String(_planningMoisActuel + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
    const dateObj   = new Date(_planningAnneeActuel, _planningMoisActuel, jour);
    const dateLabel = dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const entriesJour = _entriesForDate(_planningEntries, dateStr);

    let html = `
        <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
                ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
            </div>`;

    if (entriesJour.length === 0) {
        html += `<p style="color:#9ca3af;text-align:center;padding:20px">Aucune entrée pour ce jour</p>`;
    } else {
        entriesJour.forEach(e => {
            const s           = _configEntree(e);
            const label_entry = _labelEntree(e);
            const debutStr    = e.date_debut_str || e.date_str || e.date?.slice(0, 10);
            const finStr      = e.date_fin_str   || null;
            html += `
                <div style="background:${s.couleur}22;border-left:4px solid ${s.couleur};
                            border-radius:10px;padding:12px 14px;margin-bottom:10px">
                    <div style="font-size:16px;font-weight:700;color:#1f2937">${s.emoji} ${label_entry}</div>
                    ${finStr
                        ? `<div style="font-size:13px;color:#666;margin-top:4px">📅 Du ${debutStr} au ${finStr}</div>`
                        : e.heure_debut
                            ? `<div style="font-size:13px;color:#666;margin-top:4px">⏰ ${e.heure_debut.slice(0,5)} → ${(e.heure_fin||'').slice(0,5)||'?'}</div>`
                            : ''}
                    ${e.employeur ? `<div style="font-size:13px;color:#666">🏥 ${e.employeur}</div>`            : ''}
                    ${e.adresse   ? `<div style="font-size:12px;color:#999">📍 ${e.adresse}</div>`              : ''}
                    ${e.notes     ? `<div style="font-size:12px;color:#999;margin-top:4px">📝 ${e.notes}</div>` : ''}
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button onclick="_ouvrirFormulaireEntreePlanning(${e.id})" style="
                            flex:1;padding:8px;background:#4f46e5;color:white;
                            border:none;border-radius:8px;cursor:pointer;font-size:13px">
                            ✏️ Modifier
                        </button>
                        <button onclick="_supprimerEntreePlanning(${e.id},'${dateStr}','${label_entry}')" style="
                            flex:1;padding:8px;background:#fee2e2;color:#ef4444;
                            border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>`;
        });
    }

    html += `
        <div style="display:flex;gap:8px;margin-top:12px">
            <button onclick="_ouvrirFormulaireEntreePlanning(null,'${dateStr}')" style="
                flex:1;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                color:white;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600">
                + Ajouter une entrée
            </button>
            <button onclick="_afficherCalendrierPlanning()" style="
                padding:11px 16px;background:#f3f4f6;color:#374151;
                border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600">
                Retour
            </button>
        </div>
        </div>`;

    body.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════════
// FORMULAIRE AJOUT / ÉDITION
// ══════════════════════════════════════════════════════════════════════════

async function _ouvrirFormulaireEntreePlanning(id = null, dateDefaut = null) {
    const body = document.getElementById('modal-body');
    const { token } = _planningAuth();
    body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    let entry = {};
    if (id) {
        try {
            const res  = await fetch(`/api/planning/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache  : 'no-store'
            });
            const data = await res.json();
            entry = data.entry || data || {};
        } catch { entry = {}; }
    }

    const employeurs   = await _fetchEmployeurs(token);
    const catVal       = entry.categorie || 'Travail';
    const libelleVal   = entry.libelle_personnalise || '';
    const dateDebutVal = entry.date_debut_str || entry.date_str || entry.date?.slice(0, 10) || dateDefaut || '';
    const dateFinVal   = entry.date_fin_str   || '';
    const rappelVal    = entry.rappel_avant_shift ?? 0;
    const employeurVal = entry.employeur || '';

    const catsOptions = Object.keys(SHIFT_CONFIG).map(c =>
        `<option value="${c}" ${catVal === c ? 'selected' : ''}>${SHIFT_CONFIG[c].emoji} ${c}</option>`
    ).join('');

    const valDansListe = employeurs.includes(employeurVal);
    const showInput    = !valDansListe && employeurVal !== '';
    const employeurSelectOptions =
        employeurs.map(e =>
            `<option value="${e}" ${employeurVal === e ? 'selected' : ''}>${e}</option>`
        ).join('') +
        `<option value="__nouveau__" ${showInput ? 'selected' : ''}>➕ Autre (saisir manuellement)...</option>`;

    body.innerHTML = `
        <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
                ${id ? 'Modifier une entrée' : 'Nouvelle entrée'}
            </div>

            <div style="margin-bottom:10px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Catégorie</label>
                <select id="pl-categorie" onchange="_planningToggleChamps()"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff">
                    ${catsOptions}
                </select>
            </div>

            <div id="pl-libelle-wrap" style="margin-bottom:10px;display:${catVal === 'Autre' ? 'block' : 'none'}">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Libellé *</label>
                <input type="text" id="pl-libelle" value="${libelleVal}"
                    placeholder="Ex: Garde enfants, Formation..."
                    style="width:100%;padding:10px 12px;border:1.5px solid #4f46e5;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>

            <div style="margin-bottom:10px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de début *</label>
                <input type="date" id="pl-date-debut" value="${dateDebutVal}"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>

            <div id="pl-datefin-wrap" style="margin-bottom:10px;display:${catVal === 'Congé payé' ? 'block' : 'none'}">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de fin *</label>
                <input type="date" id="pl-date-fin" value="${dateFinVal}"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>

            <div id="pl-heures-wrap" style="display:${['Congé payé','Repos'].includes(catVal) ? 'none' : 'grid'};grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div>
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure début</label>
                    <input type="time" id="pl-debut" value="${entry.heure_debut?.slice(0,5)||''}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>
                <div>
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure fin</label>
                    <input type="time" id="pl-fin" value="${entry.heure_fin?.slice(0,5)||''}"
                        style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>
            </div>

            <div style="margin-bottom:10px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Employeur</label>
                <select id="pl-employeur-select"
                    onchange="
                        const inp = document.getElementById('pl-employeur-nouveau');
                        inp.style.display = this.value === '__nouveau__' ? 'block' : 'none';
                        if (this.value !== '__nouveau__') inp.value = '';
                    "
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                           font-size:14px;box-sizing:border-box;background:#fff;margin-bottom:6px">
                    ${employeurs.length === 0
                        ? `<option value="__nouveau__">➕ Saisir un employeur...</option>`
                        : employeurSelectOptions}
                </select>
                <input type="text" id="pl-employeur-nouveau"
                    placeholder="Nom du nouvel employeur"
                    value="${showInput ? employeurVal : ''}"
                    style="display:${showInput || employeurs.length === 0 ? 'block' : 'none'};
                           width:100%;padding:10px 12px;
                           border:1.5px solid #4f46e5;border-radius:10px;
                           font-size:14px;box-sizing:border-box;margin-top:2px">
            </div>

            <div style="margin-bottom:10px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Adresse</label>
                <input type="text" id="pl-adresse" value="${entry.adresse || ''}"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>

            <div style="margin-bottom:10px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Notes</label>
                <textarea id="pl-notes" rows="2"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;resize:none">${entry.notes || ''}</textarea>
            </div>

                        <div style="margin-bottom:16px">
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Rappel avant le shift</label>
                <select id="pl-rappel" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff">
                    ${_optionsRappel(rappelVal)}
                </select>
            </div>

            <div id="pl-msg" style="text-align:center;font-size:13px;min-height:18px;margin-bottom:8px;color:#ef4444"></div>

            <div style="display:flex;gap:8px">
                <button onclick="_sauvegarderEntreePlanning(${id || 'null'})" style="
                    flex:1;padding:13px;
                    background:linear-gradient(135deg,#4f46e5,#7c3aed);
                    color:white;border:none;border-radius:12px;
                    font-size:15px;font-weight:600;cursor:pointer">
                    💾 Sauvegarder
                </button>
                <button onclick="_afficherCalendrierPlanning()" style="
                    padding:13px 16px;background:#f3f4f6;color:#374151;
                    border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
                    Retour
                </button>
            </div>
        </div>`;
}

// ── Affichage dynamique des champs selon la catégorie ─────────────────────
function _planningToggleChamps() {
    const cat      = document.getElementById('pl-categorie')?.value;
    const libelleW = document.getElementById('pl-libelle-wrap');
    const datefinW = document.getElementById('pl-datefin-wrap');
    const heuresW  = document.getElementById('pl-heures-wrap');

    if (libelleW) libelleW.style.display = cat === 'Autre'      ? 'block' : 'none';
    if (datefinW) datefinW.style.display = cat === 'Congé payé' ? 'block' : 'none';
    if (heuresW)  heuresW.style.display  = ['Congé payé', 'Repos'].includes(cat) ? 'none' : 'grid';
}

// ── Sauvegarde ────────────────────────────────────────────────────────────
async function _sauvegarderEntreePlanning(id) {
    const { token } = _planningAuth();
    const msg       = document.getElementById('pl-msg');

    const categorie            = document.getElementById('pl-categorie').value;
    const libelle_personnalise = document.getElementById('pl-libelle')?.value?.trim() || null;
    const date_debut           = document.getElementById('pl-date-debut').value;
    const date_fin             = document.getElementById('pl-date-fin')?.value   || null;
    const heure_debut          = document.getElementById('pl-debut')?.value      || null;
    const heure_fin            = document.getElementById('pl-fin')?.value        || null;
    const adresse              = document.getElementById('pl-adresse').value     || null;
    const notes                = document.getElementById('pl-notes').value       || null;
    const rappel_avant_shift   = parseInt(document.getElementById('pl-rappel').value) || 0;

    const selectEl  = document.getElementById('pl-employeur-select');
    const nouveauEl = document.getElementById('pl-employeur-nouveau');
    const selectVal = selectEl  ? selectEl.value         : '__nouveau__';
    const nouveauVal= nouveauEl ? nouveauEl.value.trim() : '';
    const employeur = selectVal === '__nouveau__' ? nouveauVal : selectVal;

    if (!date_debut) {
        if (msg) msg.textContent = 'La date de début est obligatoire.'; return;
    }
    if (categorie === 'Autre' && !libelle_personnalise) {
        if (msg) msg.textContent = 'Le libellé est obligatoire pour la catégorie Autre.'; return;
    }
    if (categorie === 'Congé payé' && !date_fin) {
        if (msg) msg.textContent = 'La date de fin est obligatoire pour un congé payé.'; return;
    }

    const body = {
        categorie,
        libelle_personnalise : libelle_personnalise || null,
        date_debut,
        date_fin             : categorie === 'Congé payé' ? date_fin : null,
        heure_debut          : ['Congé payé', 'Repos'].includes(categorie) ? null : heure_debut,
        heure_fin            : ['Congé payé', 'Repos'].includes(categorie) ? null : heure_fin,
        employeur            : employeur || null,
        adresse,
        notes,
        rappel_avant_shift
    };

    try {
        const url    = id ? `/api/planning/${id}` : '/api/planning';
        const method = id ? 'PUT' : 'POST';
        const res    = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body   : JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (msg) msg.textContent = err.message || 'Erreur lors de la sauvegarde.';
            return;
        }

        if (body.employeur && selectVal === '__nouveau__') {
            fetch('/api/planning/employeurs', {
                method : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body   : JSON.stringify({ nom: body.employeur })
            }).catch(() => {});
        }

        await _afficherCalendrierPlanning();
        chargerWidgetPlanning();
    } catch {
        if (msg) msg.textContent = 'Erreur lors de la sauvegarde.';
    }
}

// ── Suppression entrée — message personnalisé label + date ────────────────
async function _supprimerEntreePlanning(id, dateStr, labelEntree) {
    document.getElementById('modal-title').textContent = 'Confirmation de suppression';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">
            Supprimer <strong>${labelEntree}</strong> du <strong>${dateStr}</strong> ? Cette action est irréversible.
        </p>
        <div style="display:flex;gap:8px">
            <button id="btn-planning-oui" style="
                flex:1;padding:13px;background:#ef4444;color:white;
                border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                Confirmer
            </button>
            <button id="btn-planning-non" style="
                flex:1;padding:13px;background:#f3f4f6;color:#374151;
                border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                Annuler
            </button>
        </div>`;

    document.getElementById('btn-planning-oui').onclick = async () => {
        const { token } = _planningAuth();
        try {
            await fetch(`/api/planning/${id}`, {
                method : 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            await _afficherCalendrierPlanning();
            chargerWidgetPlanning();
        } catch {
            document.getElementById('modal-body').innerHTML =
                '<p style="color:#ef4444;text-align:center;padding:20px">Erreur lors de la suppression.</p>';
        }
    };
    document.getElementById('btn-planning-non').onclick = () => _afficherCalendrierPlanning();
}

// ══════════════════════════════════════════════════════════════════════════
// GESTION DES EMPLOYEURS
// ══════════════════════════════════════════════════════════════════════════

async function _ouvrirGestionEmployeurs() {
    const body = document.getElementById('modal-body');
    const { token } = _planningAuth();
    body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    let employeurs = [];
    try {
        const res  = await fetch('/api/planning/employeurs', {
            headers: { Authorization: `Bearer ${token}` },
            cache  : 'no-store'
        });
        const data = await res.json();
        employeurs = Array.isArray(data) ? data
                   : Array.isArray(data.employeurs) ? data.employeurs
                   : [];
    } catch { employeurs = []; }

    const liste = employeurs.length > 0
        ? employeurs.map(e => `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:10px 12px;background:#f9fafb;border-radius:10px;
                        margin-bottom:8px;border:1px solid #e5e7eb">
                <span style="font-size:14px;font-weight:600;color:#1f2937">🏥 ${e.nom}</span>
                <button onclick="_supprimerEmployeur(${e.id},'${e.nom.replace(/'/g, "\\'")}')" style="
                    background:#fee2e2;color:#ef4444;border:none;border-radius:8px;
                    padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer">
                    Supprimer
                </button>
            </div>`).join('')
        : '<p style="color:#9ca3af;text-align:center;padding:12px">Aucun employeur enregistré</p>';

    body.innerHTML = `
        <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
                Mes employeurs
            </div>
            <div style="margin-bottom:16px">
                <div style="display:flex;gap:8px">
                    <input type="text" id="new-employeur-input" placeholder="Nom de l'employeur"
                        style="flex:1;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                               font-size:14px;box-sizing:border-box">
                    <button onclick="_ajouterEmployeur()" style="
                        padding:10px 16px;
                        background:linear-gradient(135deg,#4f46e5,#7c3aed);
                        color:white;border:none;border-radius:10px;
                        font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap">
                        + Ajouter
                    </button>
                </div>
                <div id="emp-msg" style="font-size:12px;color:#ef4444;min-height:16px;margin-top:4px"></div>
            </div>
            <div id="emp-liste">${liste}</div>
            <button onclick="_afficherCalendrierPlanning()" style="
                width:100%;padding:12px;background:#f3f4f6;color:#374151;
                border:none;border-radius:12px;font-size:14px;font-weight:600;
                cursor:pointer;margin-top:12px">
                ← Retour au calendrier
            </button>
        </div>`;
}

async function _ajouterEmployeur() {
    const { token } = _planningAuth();
    const input = document.getElementById('new-employeur-input');
    const msg   = document.getElementById('emp-msg');
    const nom   = input?.value?.trim();
    if (!nom) { if (msg) msg.textContent = 'Nom requis.'; return; }
    try {
        const res = await fetch('/api/planning/employeurs', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body   : JSON.stringify({ nom }),
            cache  : 'no-store'
        });
        if (!res.ok) throw new Error();
        await _ouvrirGestionEmployeurs();
    } catch {
        const m = document.getElementById('emp-msg');
        if (m) m.textContent = "Erreur lors de l'ajout.";
    }
}

async function _supprimerEmployeur(id, nom) {
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div>
            <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:#1f2937">
                Supprimer un employeur
            </div>
            <p style="color:#374151;font-size:15px;margin-bottom:20px">
                Supprimer <strong>${nom}</strong> ? Cette action est irréversible.
            </p>
            <div style="display:flex;gap:8px">
                <button id="btn-emp-oui" style="
                    flex:1;padding:13px;background:#ef4444;color:white;
                    border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                    Confirmer
                </button>
                <button id="btn-emp-non" style="
                    flex:1;padding:13px;background:#f3f4f6;color:#374151;
                    border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                    Annuler
                </button>
            </div>
        </div>`;

    document.getElementById('btn-emp-non').onclick = () => _ouvrirGestionEmployeurs();
    document.getElementById('btn-emp-oui').onclick = async () => {
        const { token } = _planningAuth();
        try {
            await fetch(`/api/planning/employeurs/${id}`, {
                method : 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            await _ouvrirGestionEmployeurs();
        } catch {
            body.innerHTML =
                '<p style="color:#ef4444;text-align:center;padding:20px">Erreur lors de la suppression.</p>';
        }
    };
}
