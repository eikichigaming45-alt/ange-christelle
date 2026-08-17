// ===================== PLANNING =====================

const SHIFT_CONFIG = {
  'Nuit'    : { emoji: '🌙', couleur: '#f4a261' },
  'R.H.'    : { emoji: '💤', couleur: '#90caf9' },
  'R.C.'    : { emoji: '🟢', couleur: '#a5d6a7' },
  'R.M.'    : { emoji: '💜', couleur: '#ce93d8' },
  'C.A.'    : { emoji: '🏖️', couleur: '#80cbc4' },
  'J.F.'    : { emoji: '🎉', couleur: '#fff176' },
  'F.L.C.'  : { emoji: '🔗', couleur: '#bcaaa4' },
  'Mission' : { emoji: '💼', couleur: '#a5d6a7' },
};

const JOURS_PLANNING = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS_PLANNING  = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_COURT     = ['jan','fév','mar','avr','mai','juin',
                        'juil','août','sep','oct','nov','déc'];

const TYPES_PRIORITE = ['Mission', 'Nuit'];

function _planningAuth() {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  return { user, token: user?.token };
}

async function _fetchPlanningMois(annee, mois, token) {
  const res  = await fetch(`/api/planning?annee=${annee}&mois=${mois}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function _optionsRappelPlanning(selected = 120) {
  const opts = [
    { v: 0,    l: 'Pas de rappel' },
    { v: 15,   l: '15 min avant' },
    { v: 30,   l: '30 min avant' },
    { v: 60,   l: '1h avant' },
    { v: 120,  l: '2h avant' },
    { v: 1440, l: 'La veille' },
  ];
  return opts.map(o => `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET — 5 jours glissants
// ══════════════════════════════════════════════════════════════════════════════
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
      const suite = await _fetchPlanningMois(dernier.getFullYear(), dernier.getMonth() + 1, token);
      entries = entries.concat(suite);
    }
  } catch {
    conteneur.innerHTML = '<p style="color:#999;font-size:13px;">Erreur de chargement</p>';
    return;
  }

  const map = {};
  entries.forEach(e => {
    const raw = e.date_str || e.date?.slice(0, 10);
    if (!raw) return;
    if (!map[raw]) map[raw] = [];
    map[raw].push(e);
  });

  let html = '';
  dates.forEach(({ obj, str }, i) => {
    const entries_jour = map[str] || [];
    const nomJour = JOURS_PLANNING[obj.getDay()];
    const label   = i === 0 ? "Aujourd'hui"
                            : `${nomJour} ${obj.getDate()} ${MOIS_COURT[obj.getMonth()]}`;

    if (entries_jour.length > 0) {
      // Si y'a une Mission ou Nuit → on masque les entrées de repos
      const hasPriorite  = entries_jour.some(e => TYPES_PRIORITE.includes(e.type));
      const aAfficher    = hasPriorite
        ? entries_jour.filter(e => TYPES_PRIORITE.includes(e.type))
        : entries_jour;

      aAfficher.forEach((entry, idx) => {
        const s = SHIFT_CONFIG[entry.type] || { emoji: '📋', couleur: '#eee' };
        html += `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                      margin-bottom:${idx === aAfficher.length - 1 ? '6px' : '2px'};
                      background:${s.couleur}22;border-left:4px solid ${s.couleur};border-radius:8px;">
            <span style="font-size:20px">${s.emoji}</span>
            <div>
              ${idx === 0 ? `<div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${label}</div>` : ''}
              <div style="font-size:14px;font-weight:700;color:#333">${entry.type}</div>
              ${entry.heure_debut ? `<div style="font-size:12px;color:#666">⏰ ${entry.heure_debut.slice(0,5)} → ${(entry.heure_fin||'').slice(0,5)||'?'}</div>` : ''}
              ${entry.employeur   ? `<div style="font-size:11px;color:#999">🏥 ${entry.employeur}</div>` : ''}
            </div>
          </div>`;
      });
    } else {
      html += `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;
                    background:#f9f9f9;border-left:4px solid #ddd;border-radius:8px;">
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

// ══════════════════════════════════════════════════════════════════════════════
// MODAL CALENDRIER MENSUEL
// ══════════════════════════════════════════════════════════════════════════════
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

  const map = {};
  _planningEntries.forEach(e => {
    const raw = e.date_str || e.date?.slice(0, 10);
    if (!raw) return;
    const d = parseInt(raw.split('-')[2], 10);
    if (!map[d]) map[d] = [];
    map[d].push(e);
  });

  const today       = new Date();
  const premierJour = new Date(_planningAnneeActuel, _planningMoisActuel, 1).getDay();
  const nbJours     = new Date(_planningAnneeActuel, _planningMoisActuel + 1, 0).getDate();
  const offset      = premierJour === 0 ? 6 : premierJour - 1;

  const legendeHTML = Object.entries(SHIFT_CONFIG).map(([type, s]) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;
                  background:${s.couleur}33;border-radius:20px;font-size:12px;font-weight:600;
                  margin:2px;border:1px solid ${s.couleur}66">
       ${s.emoji} ${type}
     </span>`
  ).join('');

  let cellules = '';
  for (let i = 0; i < offset; i++) {
    cellules += `<div style="aspect-ratio:1;min-height:44px"></div>`;
  }
  for (let j = 1; j <= nbJours; j++) {
    const isToday = (j === today.getDate() && _planningMoisActuel === today.getMonth() && _planningAnneeActuel === today.getFullYear());
        const entriesJour = map[j] || [];
    const hasPriorite = entriesJour.some(e => TYPES_PRIORITE.includes(e.type));
    const e0 = hasPriorite
        ? entriesJour.find(e => TYPES_PRIORITE.includes(e.type))
        : entriesJour[0];
    const s  = e0 ? (SHIFT_CONFIG[e0.type] || { emoji: '📋', couleur: '#eee' }) : null;
    const autresCount = entriesJour.length - 1;
    const plus = autresCount > 0 ? `<div style="font-size:9px;color:#666">+${autresCount}</div>` : '';

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
  const body = document.getElementById('modal-body');
  const dateStr   = `${_planningAnneeActuel}-${String(_planningMoisActuel+1).padStart(2,'0')}-${String(jour).padStart(2,'0')}`;
  const dateObj   = new Date(_planningAnneeActuel, _planningMoisActuel, jour);
  const dateLabel = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const entriesJour = _planningEntries.filter(e => {
    const raw = e.date_str || e.date?.slice(0,10);
    return raw === dateStr;
  });

  let html = `
    <div>
      <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
        ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      </div>`;

  if (entriesJour.length === 0) {
    html += `<p style="color:#9ca3af;text-align:center;padding:20px">Aucune entrée pour ce jour</p>`;
  } else {
    entriesJour.forEach(e => {
      const s = SHIFT_CONFIG[e.type] || { emoji: '📋', couleur: '#eee' };
      html += `
        <div style="background:${s.couleur}22;border-left:4px solid ${s.couleur};
                    border-radius:10px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:16px;font-weight:700;color:#1f2937">${s.emoji} ${e.type}</div>
          ${e.heure_debut ? `<div style="font-size:13px;color:#666;margin-top:4px">⏰ ${e.heure_debut.slice(0,5)} → ${(e.heure_fin||'').slice(0,5)||'?'}</div>` : ''}
          ${e.employeur   ? `<div style="font-size:13px;color:#666">🏥 ${e.employeur}</div>` : ''}
          ${e.adresse     ? `<div style="font-size:12px;color:#999">📍 ${e.adresse}</div>` : ''}
          ${e.notes       ? `<div style="font-size:12px;color:#999;margin-top:4px">📝 ${e.notes}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:10px">
            <button onclick="_ouvrirFormulaireEntreePlanning(${e.id})" style="
                flex:1;padding:8px;background:#4f46e5;color:white;
                border:none;border-radius:8px;cursor:pointer;font-size:13px">
              ✏️ Modifier
            </button>
            <button onclick="_supprimerEntreePlanning(${e.id},'${dateStr}')" style="
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

async function _ouvrirFormulaireEntreePlanning(id = null, dateDefaut = null) {
  const body = document.getElementById('modal-body');
  const { token } = _planningAuth();

  let entry = {};
  if (id) {
    try {
      const res  = await fetch(`/api/planning/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      entry = data.entry || data || {};
    } catch { entry = {}; }
  }

  const dateVal   = entry.date_str || entry.date?.slice(0,10) || dateDefaut || '';
  const rappelVal = entry.rappel_avant ?? 120;
  const typesOptions = Object.keys(SHIFT_CONFIG).map(t =>
    `<option value="${t}" ${entry.type === t ? 'selected' : ''}>${t}</option>`
  ).join('');

  body.innerHTML = `
    <div>
      <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937">
        ${id ? 'Modifier une entrée' : 'Nouvelle entrée'}
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date</label>
        <input type="date" id="pl-date" value="${dateVal}"
          style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
      </div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Type de journée</label>
        <select id="pl-type" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff">
          ${typesOptions}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
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
        <input type="text" id="pl-employeur" value="${entry.employeur || 'EPSM Georges Daumezon'}"
          style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
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
          ${_optionsRappelPlanning(rappelVal)}
        </select>
      </div>
      <div id="pl-msg" style="text-align:center;font-size:13px;min-height:18px;margin-bottom:8px;color:#ef4444"></div>
      <div style="display:flex;gap:8px">
        <button onclick="_sauvegarderEntreePlanning(${id || 'null'})" style="
            flex:1;padding:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
            color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
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

async function _sauvegarderEntreePlanning(id) {
  const { token } = _planningAuth();
  const msg = document.getElementById('pl-msg');

  const body = {
    date        : document.getElementById('pl-date').value,
    type        : document.getElementById('pl-type').value,
    heure_debut : document.getElementById('pl-debut').value    || null,
    heure_fin   : document.getElementById('pl-fin').value      || null,
    employeur   : document.getElementById('pl-employeur').value || null,
    adresse     : document.getElementById('pl-adresse').value   || null,
    notes       : document.getElementById('pl-notes').value     || null,
    rappel_avant: parseInt(document.getElementById('pl-rappel').value) || 0,
  };

  if (!body.date) { if (msg) msg.textContent = 'La date est obligatoire.'; return; }

  try {
    const url    = id ? `/api/planning/${id}` : '/api/planning';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error();
    await _afficherCalendrierPlanning();
    chargerWidgetPlanning();
  } catch {
    if (msg) msg.textContent = 'Erreur lors de la sauvegarde.';
  }
}

async function _supprimerEntreePlanning(id, dateStr) {
  document.getElementById('modal-title').textContent = 'Confirmation de suppression';
  document.getElementById('modal-body').innerHTML = `
    <p style="color:#333;font-size:15px;margin-bottom:20px">Supprimer cette entrée ? Cette action est irréversible.</p>
    <div class="modal-actions">
      <button class="btn-delete" id="btn-planning-oui">Confirmer</button>
      <button class="btn-cancel" id="btn-planning-non">Annuler</button>
    </div>
  `;
  document.getElementById('overlay').classList.add('on');
  document.getElementById('btn-planning-oui').onclick = async () => {
    const { token } = _planningAuth();
    try {
      await fetch(`/api/planning/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await _afficherCalendrierPlanning();
      chargerWidgetPlanning();
    } catch {
      document.getElementById('modal-title').textContent = 'Erreur';
      document.getElementById('modal-body').innerHTML = `
        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la suppression.</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="_afficherCalendrierPlanning()">Retour</button>
        </div>`;
    }
  };
  document.getElementById('btn-planning-non').onclick = () => {
    if (dateStr) _ouvrirDetailJourPlanning(parseInt(dateStr.split('-')[2]));
    else _afficherCalendrierPlanning();
  };
}

window.ouvrirPlanningModal             = ouvrirPlanningModal;
window.chargerWidgetPlanning           = chargerWidgetPlanning;
window._planningMoisPrec               = _planningMoisPrec;
window._planningMoisSuiv               = _planningMoisSuiv;
window._ouvrirDetailJourPlanning       = _ouvrirDetailJourPlanning;
window._ouvrirFormulaireEntreePlanning = _ouvrirFormulaireEntreePlanning;
window._sauvegarderEntreePlanning      = _sauvegarderEntreePlanning;
window._supprimerEntreePlanning        = _supprimerEntreePlanning;
window._afficherCalendrierPlanning     = _afficherCalendrierPlanning;
