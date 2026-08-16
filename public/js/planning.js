// ===================== WIDGET & MODALE PLANNING =====================

const TYPE_COULEURS = {
    'Nuit'    : { bg: '#fff3e0', border: '#f97316', text: '#ea580c', emoji: '🌙' },
    'R.H.'    : { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb', emoji: '💤' },
    'R.C.'    : { bg: '#f0fdf4', border: '#22c55e', text: '#16a34a', emoji: '🟢' },
    'R.M.'    : { bg: '#f5f3ff', border: '#8b5cf6', text: '#7c3aed', emoji: '💜' },
    'C.A.'    : { bg: '#fdf4ff', border: '#d946ef', text: '#c026d3', emoji: '🏖️' },
    'J.F.'    : { bg: '#fefce8', border: '#eab308', text: '#ca8a04', emoji: '🎉' },
    'F.L.C.'  : { bg: '#f1f5f9', border: '#64748b', text: '#475569', emoji: '🔗' },
    'Mission' : { bg: '#fff1f2', border: '#ef4444', text: '#dc2626', emoji: '💼' },
};

function getCouleur(type) {
    return TYPE_COULEURS[type] || { bg: '#f9fafb', border: '#9ca3af', text: '#6b7280', emoji: '📋' };
}

function authHeaders() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token || ''}`
    };
}

async function chargerWidgetPlanning() {
    const el = document.getElementById('wc-planning');
    if (!el) return;
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.token) return;

    const now = new Date();
    const annee = now.getFullYear();
    const mois  = String(now.getMonth()+1).padStart(2,'0');
    const jour  = String(now.getDate()).padStart(2,'0');
    const dateStr = `${annee}-${mois}-${jour}`;

    try {
        const res = await fetch(`/api/planning/jour?date=${dateStr}`, { headers: authHeaders() });
        const data = await res.json();

        if (!data.success || data.planning.length === 0) {
            el.innerHTML = `<span style="color:#9ca3af">Pas de garde aujourd'hui</span>`;
            return;
        }

        el.innerHTML = data.planning.map(p => {
            const c = getCouleur(p.type);
            const heures = p.heure_debut && p.heure_fin
                ? `${p.heure_debut.slice(0,5)} → ${p.heure_fin.slice(0,5)}`
                : '';
            return `
                <div style="background:${c.bg};border-left:3px solid ${c.border};border-radius:8px;padding:6px 10px;margin-bottom:4px">
                    <span style="color:${c.text};font-weight:700;font-size:13px">${c.emoji} ${p.type}</span>
                    ${heures ? `<span style="color:${c.text};font-size:12px;margin-left:6px">${heures}</span>` : ''}
                    <div style="color:#6b7280;font-size:11px;margin-top:2px">${p.employeur || ''}</div>
                </div>
            `;
        }).join('');
    } catch(e) {
        el.innerHTML = `<span style="color:#9ca3af">Erreur de chargement</span>`;
    }
}

// ── Modale calendrier ─────────────────────────────────────

let planningMoisCourant = new Date().getMonth();
let planningAnneeCourante = new Date().getFullYear();
let planningData = {};

async function ouvrirModalPlanning() {
    document.getElementById('modal-title').textContent = '📋 Mon Planning';
    document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
    document.getElementById('overlay').classList.add('on');
    await chargerMoisPlanning(planningAnneeCourante, planningMoisCourant);
}

async function chargerMoisPlanning(annee, mois) {
    try {
        const res = await fetch(`/api/planning?mois=${mois+1}&annee=${annee}`, { headers: authHeaders() });
        const data = await res.json();

        // Indexe par date
        planningData = {};
        if (data.success) {
            data.planning.forEach(p => {
                const key = p.date.split('T')[0];
                if (!planningData[key]) planningData[key] = [];
                planningData[key].push(p);
            });
        }

        afficherCalendrier(annee, mois);
    } catch(e) {
        document.getElementById('modal-body').innerHTML = '<p style="color:#ef4444">Erreur de chargement</p>';
    }
}

function afficherCalendrier(annee, mois) {
    const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const premier = new Date(annee, mois, 1);
    const dernier = new Date(annee, mois+1, 0);
    let debutSemaine = premier.getDay() === 0 ? 6 : premier.getDay()-1;

    let cases = [];
    // Cases vides avant le 1er
    for (let i = 0; i < debutSemaine; i++) cases.push(null);
    // Jours du mois
    for (let j = 1; j <= dernier.getDate(); j++) cases.push(j);
    // Complète la dernière semaine
    while (cases.length % 7 !== 0) cases.push(null);

    document.getElementById('modal-body').innerHTML = `
        <!-- Navigation mois -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <button onclick="naviguerMois(-1)" style="background:#f3f4f6;border:none;border-radius:10px;padding:8px 14px;cursor:pointer;font-size:16px">‹</button>
            <div style="font-weight:700;font-size:16px;color:#111">${MOIS_NOMS[mois]} ${annee}</div>
            <button onclick="naviguerMois(1)" style="background:#f3f4f6;border:none;border-radius:10px;padding:8px 14px;cursor:pointer;font-size:16px">›</button>
        </div>

        <!-- Légende -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
            ${Object.entries(TYPE_COULEURS).map(([type, c]) => `
                <span style="background:${c.bg};border:1px solid ${c.border};color:${c.text};font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px">${c.emoji} ${type}</span>
            `).join('')}
        </div>

        <!-- Grille calendrier -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:16px">
            ${JOURS.map(j => `<div style="text-align:center;font-size:11px;font-weight:700;color:#9ca3af;padding:4px 0">${j}</div>`).join('')}
            ${cases.map(jour => {
                if (!jour) return `<div></div>`;
                const dateStr = `${annee}-${String(mois+1).padStart(2,'0')}-${String(jour).padStart(2,'0')}`;
                const entrees = planningData[dateStr] || [];
                const isToday = dateStr === todayStr;
                const couleur = entrees.length > 0 ? getCouleur(entrees[0].type) : null;
                const bg = couleur ? couleur.bg : '#f9fafb';
                const border = isToday ? '2px solid #4f46e5' : couleur ? `1px solid ${couleur.border}` : '1px solid #e5e7eb';
                const emoji = entrees.length > 0 ? getCouleur(entrees[0].type).emoji : '';
                return `
                    <div onclick="ouvrirJourPlanning('${dateStr}')"
                        style="background:${bg};border:${border};border-radius:8px;padding:4px 2px;text-align:center;cursor:pointer;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;${isToday?'box-shadow:0 0 0 2px #4f46e5;':''}">
                        <div style="font-size:12px;font-weight:${isToday?'700':'500'};color:${isToday?'#4f46e5':'#374151'}">${jour}</div>
                        ${emoji ? `<div style="font-size:14px">${emoji}</div>` : ''}
                        ${entrees.length > 1 ? `<div style="font-size:9px;color:#6b7280">+${entrees.length-1}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>

        <button onclick="ouvrirFormulaireAjoutPlanning(null)" style="width:100%;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
            ➕ Ajouter une entrée
        </button>
    `;
}

function naviguerMois(direction) {
    planningMoisCourant += direction;
    if (planningMoisCourant > 11) { planningMoisCourant = 0; planningAnneeCourante++; }
    if (planningMoisCourant < 0)  { planningMoisCourant = 11; planningAnneeCourante--; }
    chargerMoisPlanning(planningAnneeCourante, planningMoisCourant);
}

async function ouvrirJourPlanning(dateStr) {
    const entrees = planningData[dateStr] || [];
    const date = new Date(dateStr+'T12:00:00');
    const dateLabel = date.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

    document.getElementById('modal-title').textContent = `📋 ${dateLabel}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom:16px">
            ${entrees.length === 0
                ? `<p style="color:#9ca3af;text-align:center;margin-bottom:16px">Aucune entrée pour ce jour</p>`
                : entrees.map(p => {
                    const c = getCouleur(p.type);
                    const heures = p.heure_debut && p.heure_fin
                        ? `${p.heure_debut.slice(0,5)} → ${p.heure_fin.slice(0,5)}`
                        : 'Horaires non définis';
                    return `
                        <div style="background:${c.bg};border:1.5px solid ${c.border};border-radius:12px;padding:12px;margin-bottom:10px">
                            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                                <div>
                                    <div style="font-weight:700;color:${c.text};font-size:15px">${c.emoji} ${p.type}</div>
                                    <div style="color:#374151;font-size:13px;margin-top:4px">⏰ ${heures}</div>
                                    <div style="color:#6b7280;font-size:12px;margin-top:2px">🏥 ${p.employeur || 'EPSM Georges Daumezon'}</div>
                                    ${p.adresse ? `<div style="color:#6b7280;font-size:12px">📍 ${p.adresse}</div>` : ''}
                                    ${p.telephone ? `<div style="color:#6b7280;font-size:12px">📞 ${p.telephone}</div>` : ''}
                                    ${p.notes ? `<div style="color:#6b7280;font-size:12px;margin-top:4px;font-style:italic">📝 ${p.notes}</div>` : ''}
                                </div>
                                <div style="display:flex;gap:6px">
                                    <button onclick="ouvrirFormulaireAjoutPlanning('${dateStr}', ${p.id})"
                                        style="background:#f3f4f6;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px">✏️</button>
                                    <button onclick="supprimerEntreePlanning(${p.id}, '${dateStr}')"
                                        style="background:#fff1f2;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:14px">🗑️</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div style="display:flex;gap:8px">
            <button onclick="ouvrirFormulaireAjoutPlanning('${dateStr}')"
                style="flex:1;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
                ➕ Ajouter une entrée
            </button>
            <button onclick="chargerMoisPlanning(${planningAnneeCourante}, ${planningMoisCourant})"
                style="padding:12px 16px;background:#f3f4f6;border:none;border-radius:12px;cursor:pointer;font-size:14px">
                ← Retour
            </button>
        </div>
    `;
}

async function ouvrirFormulaireAjoutPlanning(dateStr = null, id = null) {
    let entree = null;
    if (id) {
        // Cherche dans planningData
        for (const key in planningData) {
            const found = planningData[key].find(p => p.id === id);
            if (found) { entree = found; break; }
        }
    }

    const TYPES = ['Nuit', 'R.H.', 'R.C.', 'R.M.', 'C.A.', 'J.F.', 'F.L.C.', 'Mission'];
    const dateVal = entree ? entree.date.split('T')[0] : (dateStr || '');

    document.getElementById('modal-title').textContent = id ? '✏️ Modifier l\'entrée' : '➕ Nouvelle entrée';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date</label>
                <input type="date" id="pl-date" value="${dateVal}" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Type</label>
                <select id="pl-type" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                    ${TYPES.map(t => `<option value="${t}" ${entree?.type===t?'selected':''}>${getCouleur(t).emoji} ${t}</option>`).join('')}
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div>
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure début</label>
                    <input type="time" id="pl-debut" value="${entree?.heure_debut?.slice(0,5)||''}" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>
                <div>
                    <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Heure fin</label>
                    <input type="time" id="pl-fin" value="${entree?.heure_fin?.slice(0,5)||''}" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                </div>
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Employeur</label>
                <input type="text" id="pl-employeur" value="${entree?.employeur||'EPSM Georges Daumezon'}" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Adresse</label>
                <input type="text" id="pl-adresse" value="${entree?.adresse||''}" placeholder="Adresse (optionnel)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Téléphone</label>
                <input type="tel" id="pl-tel" value="${entree?.telephone||''}" placeholder="Téléphone (optionnel)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Notes</label>
                <textarea id="pl-notes" rows="2" placeholder="Notes (optionnel)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;resize:none">${entree?.notes||''}</textarea>
            </div>
            <div>
                <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Rappel avant la prise de poste</label>
                <select id="pl-rappel" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box">
                    <option value="0">Pas de rappel</option>
                    <option value="30">30 min avant</option>
                    <option value="60">1h avant</option>
                    <option value="120" ${!entree||entree.rappel_avant===120?'selected':''}>2h avant</option>
                    <option value="180">3h avant</option>
                    <option value="240">4h avant</option>
                </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
                <button onclick="sauvegarderEntreePlanning(${id||'null'}, '${dateStr||''}')"
                    style="flex:1;padding:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
                    💾 ${id ? 'Modifier' : 'Enregistrer'}
                </button>
                <button onclick="ouvrirJourPlanning('${dateVal}')"
                    style="padding:13px 16px;background:#f3f4f6;border:none;border-radius:12px;cursor:pointer;font-size:14px">
                    ← Retour
                </button>
            </div>
        </div>
    `;
}

async function sauvegarderEntreePlanning(id = null, dateStr = '') {
    const date     = document.getElementById('pl-date').value;
    const type     = document.getElementById('pl-type').value;
    const debut    = document.getElementById('pl-debut').value;
    const fin      = document.getElementById('pl-fin').value;
    const employeur = document.getElementById('pl-employeur').value;
    const adresse  = document.getElementById('pl-adresse').value;
    const tel      = document.getElementById('pl-tel').value;
    const notes    = document.getElementById('pl-notes').value;
    const rappel   = parseInt(document.getElementById('pl-rappel').value) || 0;

    if (!date) { alert('La date est obligatoire'); return; }

    const body = { date, type, heure_debut: debut||null, heure_fin: fin||null, employeur, adresse, telephone: tel, notes, rappel_avant: rappel };
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/planning/${id}` : '/api/planning';

    try {
        const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
        const d = await res.json();
        if (d.success) {
            await chargerMoisPlanning(planningAnneeCourante, planningMoisCourant);
            await ouvrirJourPlanning(date);
            chargerWidgetPlanning();
        } else {
            alert('Erreur lors de la sauvegarde');
        }
    } catch(e) {
        alert('Erreur réseau');
    }
}

async function supprimerEntreePlanning(id, dateStr) {
    document.getElementById('modal-title').textContent = '🗑️ Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Supprimer cette entrée du planning ? Cette action est irréversible.</p>
        <div style="display:flex;gap:8px">
            <button id="btn-planning-oui" style="flex:1;padding:13px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">🗑️ Confirmer</button>
            <button onclick="ouvrirJourPlanning('${dateStr}')" style="flex:1;padding:13px;background:#f3f4f6;border:none;border-radius:12px;font-size:15px;cursor:pointer">Annuler</button>
        </div>
    `;
    document.getElementById('btn-planning-oui').onclick = async () => {
        try {
            const res = await fetch(`/api/planning/${id}`, { method: 'DELETE', headers: authHeaders() });
            const d = await res.json();
            if (d.success) {
                await chargerMoisPlanning(planningAnneeCourante, planningMoisCourant);
                await ouvrirJourPlanning(dateStr);
                chargerWidgetPlanning();
            }
        } catch(e) { alert('Erreur réseau'); }
    };
}
