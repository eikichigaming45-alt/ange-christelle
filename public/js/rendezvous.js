// ============================================================
// public/js/rendezvous.js
// Rendez-vous médicaux — CRUD complet + widget + modal.
// ============================================================

const Rendezvous = (() => {

  function authHeaders() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user?.token || ''}`
    };
  }

  function formatDateHeure(dt) {
    const d = new Date(dt);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateTimeInput(dt) {
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localInputToISO(val) {
    const [datePart, timePart] = val.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min]  = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, h, min).toISOString();
  }

  function joursRestants(dt) {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const rdvDate = new Date(dt);
    rdvDate.setHours(0, 0, 0, 0);
    const jours = Math.round((rdvDate - aujourdhui) / (1000 * 60 * 60 * 24));
    if (jours < 0)   return { label: 'Passé',          cls: 'rdv-passe' };
    if (jours === 0) return { label: "Aujourd'hui !",  cls: 'rdv-today' };
    if (jours === 1) return { label: 'Demain',          cls: 'rdv-soon'  };
    if (jours <= 7)  return { label: `Dans ${jours}j`, cls: 'rdv-soon'  };
    return                  { label: `Dans ${jours}j`, cls: 'rdv-futur' };
  }

  function formatRappel(minutes) {
    if (minutes === 1440) return 'La veille';
    if (minutes >= 60)    return `${minutes / 60}h avant`;
    return `${minutes} min avant`;
  }

  const TYPE_ICONS = {
    'Généraliste'      : '🩺',
    'Gynécologue'      : '🌸',
    'Dentiste'         : '🦷',
    'Ophtalmologue'    : '👁️',
    'Dermatologue'     : '💊',
    'Kinésithérapeute' : '🤸',
    'Urgences'         : '🚨',
    'Autre'            : '📋'
  };

  const TYPES = Object.keys(TYPE_ICONS);

  // ── Fetch — extrait correctement { success, rendezvous: [...] } ──────────

  async function fetchRdvs() {
    const res = await fetch('/api/rendezvous', { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.rendezvous || []);
  }

  // ── Rendu widget ─────────────────────────────────────────────────────────

  function renderWidget(rdvs) {
    const maintenant = new Date();
    const prochains  = rdvs.filter(r => new Date(r.date_rdv) >= maintenant).slice(0, 3);
    const passeCount = rdvs.filter(r => new Date(r.date_rdv) <  maintenant).length;

    if (rdvs.length === 0) {
      return `
        <div class="widget-rdv">
          <p class="rdv-empty">Aucun rendez-vous enregistré.</p>
          <button class="btn-rdv-primary" onclick="Rendezvous.ouvrirModal()">+ Ajouter un rendez-vous</button>
        </div>`;
    }

    const cartes = prochains.map(r => {
      const { label, cls } = joursRestants(r.date_rdv);
      return `
        <div class="rdv-card ${cls}" onclick="Rendezvous.ouvrirDetail(${r.id})">
          <div class="rdv-card-top">
            <span class="rdv-card-titre">${r.titre}</span>
            <span class="rdv-badge ${cls}">${label}</span>
          </div>
          <div class="rdv-card-date">${formatDateHeure(r.date_rdv)}</div>
          ${r.praticien    ? `<div class="rdv-card-sub">Dr. ${r.praticien}</div>` : ''}
          ${r.lieu         ? `<div class="rdv-card-sub">📍 ${r.lieu}</div>` : ''}
          ${r.rappel_avant > 0 ? `<div class="rdv-card-sub">⏰ Rappel ${formatRappel(r.rappel_avant)}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="widget-rdv">
        ${cartes}
        <div class="rdv-actions">
          <button class="btn-rdv-primary" onclick="Rendezvous.ouvrirModal()">+ Ajouter</button>
          <button class="btn-rdv-secondary" onclick="Rendezvous.ouvrirListe()">
            Tous les RDV (${rdvs.length})${passeCount > 0
              ? ` <span class="rdv-passe-badge">${passeCount} passé${passeCount > 1 ? 's' : ''}</span>`
              : ''}
          </button>
        </div>
      </div>`;
  }

  // ── Détail (lecture seule) ───────────────────────────────────────────────

  async function ouvrirDetail(id) {
    let rdv = null;
    try {
      const rdvs = await fetchRdvs();
      rdv = rdvs.find(r => r.id === id) || null;
    } catch { /* silencieux */ }
    if (!rdv) return;

    const { label, cls } = joursRestants(rdv.date_rdv);
    const icon = TYPE_ICONS[rdv.type_rdv] || '📋';

    document.getElementById('modal-title').textContent = rdv.titre;
    document.getElementById('modal-body').innerHTML = `
      <div class="rdv-detail">
        <div class="rdv-detail-badge ${cls}">${label}</div>
        <div class="rdv-detail-row">📅 <span>${formatDateHeure(rdv.date_rdv)}</span></div>
        ${rdv.type_rdv  ? `<div class="rdv-detail-row">${icon} <span>${rdv.type_rdv}</span></div>` : ''}
        ${rdv.praticien ? `<div class="rdv-detail-row">👨‍⚕️ <span>Dr. ${rdv.praticien}</span></div>` : ''}
        ${rdv.lieu      ? `<div class="rdv-detail-row">📍 <span>${rdv.lieu}</span></div>` : ''}
        ${rdv.notes     ? `<div class="rdv-detail-notes">📝 ${rdv.notes}</div>` : ''}
        ${rdv.rappel_avant > 0
          ? `<div class="rdv-detail-row">⏰ <span>Rappel ${formatRappel(rdv.rappel_avant)}</span></div>`
          : ''}
        <div class="modal-actions" style="margin-top:16px">
          <button class="btn-save"   onclick="Rendezvous.ouvrirModal(${rdv.id})">✏️ Modifier</button>
          <button class="btn-delete" onclick="Rendezvous.supprimer(${rdv.id})">Supprimer</button>
          <button class="btn-cancel" onclick="closeModal()">Fermer</button>
        </div>
      </div>`;
    document.getElementById('overlay').classList.add('on');
  }

  // ── Chargement widget ────────────────────────────────────────────────────

  async function charger() {
    const container = document.getElementById('widget-rdv-content');
    if (!container) return;
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.token) { setTimeout(() => charger(), 300); return; }
    try {
      const rdvs = await fetchRdvs();
      container.innerHTML = renderWidget(rdvs);
    } catch {
      container.innerHTML = `<p class="rdv-error">Erreur de chargement.</p>`;
    }
  }

  // ── Modal ajout / édition ────────────────────────────────────────────────

  async function ouvrirModal(id = null) {
    let rdv = null;
    if (id) {
      try {
        const rdvs = await fetchRdvs();
        rdv = rdvs.find(r => r.id === id) || null;
      } catch { /* silencieux */ }
    }

    const optionsTypes = TYPES.map(t =>
      `<option value="${t}" ${rdv?.type_rdv === t ? 'selected' : ''}>${TYPE_ICONS[t]} ${t}</option>`
    ).join('');

    const now       = formatDateTimeInput(new Date());
    const rappelVal = rdv?.rappel_avant || 0;

    document.getElementById('modal-title').textContent = rdv ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous';
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-rdv-form">
        <label>Motif / Titre *</label>
        <input type="text" id="rdv-titre" placeholder="Ex: Consultation annuelle" value="${rdv?.titre || ''}" />

        <label>Date et heure *</label>
        <input type="datetime-local" id="rdv-date" value="${rdv ? formatDateTimeInput(rdv.date_rdv) : now}" />

        <label>Type de rendez-vous</label>
        <select id="rdv-type">
          <option value="">-- Choisir --</option>
          ${optionsTypes}
        </select>

        <label>Praticien / Médecin</label>
        <input type="text" id="rdv-praticien" placeholder="Nom du praticien" value="${rdv?.praticien || ''}" />

        <label>Lieu / Cabinet</label>
        <input type="text" id="rdv-lieu" placeholder="Adresse ou nom du cabinet" value="${rdv?.lieu || ''}" />

        <label>Notes</label>
        <textarea id="rdv-notes" rows="3" placeholder="Documents à apporter, questions...">${rdv?.notes || ''}</textarea>

        <label>Rappel avant le rendez-vous</label>
        <select id="rdv-rappel">
          <option value="0"    ${rappelVal===0    ? 'selected':''}>Pas de rappel</option>
          <option value="15"   ${rappelVal===15   ? 'selected':''}>15 min avant</option>
          <option value="30"   ${rappelVal===30   ? 'selected':''}>30 min avant</option>
          <option value="60"   ${rappelVal===60   ? 'selected':''}>1h avant</option>
          <option value="120"  ${rappelVal===120  ? 'selected':''}>2h avant</option>
          <option value="1440" ${rappelVal===1440 ? 'selected':''}>La veille</option>
        </select>

        <div class="modal-actions">
          <button class="btn-save" onclick="Rendezvous.sauvegarder(${rdv?.id || 'null'})">
            ${rdv ? 'Modifier' : 'Enregistrer'}
          </button>
          ${rdv ? `<button class="btn-delete" onclick="Rendezvous.supprimer(${rdv.id})">Supprimer</button>` : ''}
          <button class="btn-cancel" onclick="closeModal()">Annuler</button>
        </div>
      </div>`;
    document.getElementById('overlay').classList.add('on');
  }

  // ── Sauvegarder ─────────────────────────────────────────────────────────

  async function sauvegarder(id = null) {
    const titre        = document.getElementById('rdv-titre').value.trim();
    const date_rdv_raw = document.getElementById('rdv-date').value;
    const type_rdv     = document.getElementById('rdv-type').value;
    const praticien    = document.getElementById('rdv-praticien').value.trim();
    const lieu         = document.getElementById('rdv-lieu').value.trim();
    const notes        = document.getElementById('rdv-notes').value.trim();
    const rappel_avant = parseInt(document.getElementById('rdv-rappel').value) || 0;

    if (!titre) {
      document.getElementById('modal-title').textContent = 'Champ manquant';
      document.getElementById('modal-body').innerHTML = `
        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Le motif est obligatoire.</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="Rendezvous.ouvrirModal(${id || 'null'})">Retour</button>
        </div>`;
      return;
    }
    if (!date_rdv_raw) {
      document.getElementById('modal-title').textContent = 'Champ manquant';
      document.getElementById('modal-body').innerHTML = `
        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">La date est obligatoire.</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="Rendezvous.ouvrirModal(${id || 'null'})">Retour</button>
        </div>`;
      return;
    }

    const date_rdv = localInputToISO(date_rdv_raw);
    const method   = id ? 'PUT' : 'POST';
    const url      = id ? `/api/rendezvous/${id}` : '/api/rendezvous';

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ titre, date_rdv, type_rdv, praticien, lieu, notes, rappel_avant })
      });
      if (!res.ok) throw new Error();
      closeModal();
      charger();
    } catch {
      document.getElementById('modal-title').textContent = 'Erreur';
      document.getElementById('modal-body').innerHTML = `
        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la sauvegarde.</p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="Rendezvous.ouvrirModal(${id || 'null'})">Retour</button>
        </div>`;
    }
  }

  // ── Supprimer ────────────────────────────────────────────────────────────

  async function supprimer(id) {
    document.getElementById('modal-title').textContent = 'Confirmation de suppression';
    document.getElementById('modal-body').innerHTML = `
      <p style="color:#333;font-size:15px;margin-bottom:20px">
        Supprimer ce rendez-vous ? Cette action est irréversible.
      </p>
      <div class="modal-actions">
        <button class="btn-delete" id="btn-rdv-oui">Confirmer</button>
        <button class="btn-cancel" id="btn-rdv-non">Annuler</button>
      </div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-rdv-oui').onclick = async () => {
      try {
        await fetch(`/api/rendezvous/${id}`, { method: 'DELETE', headers: authHeaders() });
        closeModal();
        charger();
      } catch {
        document.getElementById('modal-title').textContent = 'Erreur';
        document.getElementById('modal-body').innerHTML = `
          <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la suppression.</p>
          <div class="modal-actions">
            <button class="btn-cancel" onclick="closeModal()">Fermer</button>
          </div>`;
      }
    };
    document.getElementById('btn-rdv-non').onclick = () => closeModal();
  }

  // ── Liste complète ───────────────────────────────────────────────────────

  async function ouvrirListe() {
    try {
      const rdvs       = await fetchRdvs();
      const maintenant = new Date();
      const prochains  = rdvs.filter(r => new Date(r.date_rdv) >= maintenant);
      const passes     = rdvs.filter(r => new Date(r.date_rdv) <  maintenant);

      const renderLigne = r => {
        const { label, cls } = joursRestants(r.date_rdv);
        const icon = TYPE_ICONS[r.type_rdv] || '📋';
        return `
          <div class="rdv-liste-item ${cls}" onclick="Rendezvous.ouvrirDetail(${r.id})" style="cursor:pointer">
            <span class="rdv-liste-icon">${icon}</span>
            <div class="rdv-liste-body">
              <strong>${r.titre}</strong>
              <span>${formatDateHeure(r.date_rdv)}</span>
              ${r.praticien ? `<span>Dr. ${r.praticien}</span>` : ''}
              ${r.lieu      ? `<span>📍 ${r.lieu}</span>` : ''}
            </div>
            <div class="rdv-liste-right">
              <span class="rdv-badge ${cls}">${label}</span>
            </div>
          </div>`;
      };

      document.getElementById('modal-title').textContent = 'Tous mes rendez-vous';
      document.getElementById('modal-body').innerHTML = `
        <div class="rdv-liste">
          ${prochains.length > 0
            ? `<div class="rdv-section-title">À venir (${prochains.length})</div>
               ${prochains.map(renderLigne).join('')}`
            : '<p class="rdv-empty">Aucun rendez-vous à venir.</p>'
          }
          ${passes.length > 0
            ? `<div class="rdv-section-title rdv-passe-title">Passés (${passes.length})</div>
               ${passes.map(renderLigne).join('')}`
            : ''
          }
          <button class="btn-rdv-primary" style="margin-top:14px"
            onclick="Rendezvous.ouvrirModal()">+ Nouveau rendez-vous</button>
        </div>`;
      document.getElementById('overlay').classList.add('on');
    } catch {
      document.getElementById('modal-title').textContent = 'Erreur';
      document.getElementById('modal-body').innerHTML = `
        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">
          Erreur de chargement des rendez-vous.
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeModal()">Fermer</button>
        </div>`;
    }
  }

  return { charger, ouvrirModal, ouvrirDetail, sauvegarder, supprimer, ouvrirListe };

})();
