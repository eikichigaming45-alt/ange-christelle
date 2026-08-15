// ============================================================
// RENDEZ-VOUS MÉDICAUX — rendezvous.js
// ============================================================

const Rendezvous = (() => {

  // ── Helpers ──────────────────────────────────────────────

  function authHeaders() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user?.token || ''}`
    };
  }

  function formatDateHeure(dt) {
    return new Date(dt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateTimeInput(dt) {
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function joursRestants(dt) {
    const diff  = new Date(dt) - new Date();
    const jours = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (jours < 0)   return { label: 'Passé',           cls: 'rdv-passe' };
    if (jours === 0) return { label: 'Aujourd\'hui !',  cls: 'rdv-today' };
    if (jours === 1) return { label: 'Demain',           cls: 'rdv-soon'  };
    if (jours <= 7)  return { label: `Dans ${jours}j`,  cls: 'rdv-soon'  };
    return               { label: `Dans ${jours} jours`, cls: 'rdv-futur' };
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

  // ── Rendu widget ─────────────────────────────────────────

  function renderWidget(rdvs) {
    const maintenant = new Date();
    const prochains  = rdvs.filter(r => new Date(r.date_rdv) >= maintenant).slice(0, 3);
    const passeCount = rdvs.filter(r => new Date(r.date_rdv) <  maintenant).length;

    if (rdvs.length === 0) {
      return `
        <div class="widget-rdv">
          <p class="rdv-empty">Aucun rendez-vous enregistré.</p>
          <button class="btn-rdv-primary" onclick="Rendezvous.ouvrirModal()">
            + Ajouter un rendez-vous
          </button>
        </div>
      `;
    }

    const cartes = prochains.map(r => {
      const { label, cls } = joursRestants(r.date_rdv);
      const icon = TYPE_ICONS[r.type_rdv] || '📋';
      return `
        <div class="rdv-card ${cls}" onclick="Rendezvous.ouvrirModal(${r.id})">
          <div class="rdv-card-icon">${icon}</div>
          <div class="rdv-card-body">
            <div class="rdv-card-titre">${r.titre}</div>
            <div class="rdv-card-date">${formatDateHeure(r.date_rdv)}</div>
            ${r.praticien ? `<div class="rdv-card-sub">Dr. ${r.praticien}</div>` : ''}
            ${r.lieu      ? `<div class="rdv-card-sub">📍 ${r.lieu}</div>`       : ''}
          </div>
          <div class="rdv-badge ${cls}">${label}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="widget-rdv">
        ${cartes}
        <div class="rdv-actions">
          <button class="btn-rdv-primary" onclick="Rendezvous.ouvrirModal()">
            + Ajouter
          </button>
          <button class="btn-rdv-secondary" onclick="Rendezvous.ouvrirListe()">
            Tous les RDV (${rdvs.length})
            ${passeCount > 0 ? `<span class="rdv-passe-badge">${passeCount} passé${passeCount > 1 ? 's' : ''}</span>` : ''}
          </button>
        </div>
      </div>
    `;
  }

  // ── Chargement principal ─────────────────────────────────

  async function charger() {
    const container = document.getElementById('widget-rdv-content');
    if (!container) return;
    try {
      const res  = await fetch('/api/rendezvous', { headers: authHeaders() });
      const rdvs = await res.json();
      container.innerHTML = renderWidget(Array.isArray(rdvs) ? rdvs : []);
    } catch {
      container.innerHTML = `<p class="rdv-error">Erreur de chargement.</p>`;
    }
  }

  // ── Modal ajout / édition ────────────────────────────────

  async function ouvrirModal(id = null) {
    let rdv = null;

    if (id) {
      try {
        const res  = await fetch('/api/rendezvous', { headers: authHeaders() });
        const rdvs = await res.json();
        rdv = rdvs.find(r => r.id === id) || null;
      } catch { /* silencieux */ }
    }

    const optionsTypes = TYPES.map(t =>
      `<option value="${t}" ${rdv?.type_rdv === t ? 'selected' : ''}>${TYPE_ICONS[t]} ${t}</option>`
    ).join('');

    const now = formatDateTimeInput(new Date());

    document.getElementById('modal-title').textContent = rdv ? '✏️ Modifier le rendez-vous' : '🩺 Nouveau rendez-vous';
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-rdv-form">
        <label>Motif / Titre *</label>
        <input type="text" id="rdv-titre" placeholder="Ex: Consultation annuelle"
          value="${rdv?.titre || ''}" />

        <label>Date et heure *</label>
        <input type="datetime-local" id="rdv-date"
          value="${rdv ? formatDateTimeInput(rdv.date_rdv) : now}" />

        <label>Type de rendez-vous</label>
        <select id="rdv-type">
          <option value="">-- Choisir --</option>
          ${optionsTypes}
        </select>

        <label>Praticien / Médecin</label>
        <input type="text" id="rdv-praticien" placeholder="Nom du praticien"
          value="${rdv?.praticien || ''}" />

        <label>Lieu / Cabinet</label>
        <input type="text" id="rdv-lieu" placeholder="Adresse ou nom du cabinet"
          value="${rdv?.lieu || ''}" />

        <label>Notes</label>
        <textarea id="rdv-notes" rows="3"
          placeholder="Documents à apporter, questions...">${rdv?.notes || ''}</textarea>

        <div class="modal-actions">
          <button class="btn-save" onclick="Rendezvous.sauvegarder(${rdv?.id || 'null'})">
            ${rdv ? 'Modifier' : 'Enregistrer'}
          </button>
          ${rdv ? `<button class="btn-delete" onclick="Rendezvous.supprimer(${rdv.id})">Supprimer</button>` : ''}
          <button class="btn-cancel" onclick="closeModal()">Annuler</button>
        </div>
      </div>
    `;
    document.getElementById('overlay').classList.add('on');
  }

  // ── Sauvegarder ──────────────────────────────────────────

  async function sauvegarder(id = null) {
    const titre     = document.getElementById('rdv-titre').value.trim();
    const date_rdv  = document.getElementById('rdv-date').value;
    const type_rdv  = document.getElementById('rdv-type').value;
    const praticien = document.getElementById('rdv-praticien').value.trim();
    const lieu      = document.getElementById('rdv-lieu').value.trim();
    const notes     = document.getElementById('rdv-notes').value.trim();

    if (!titre)    return alert('Le motif est obligatoire.');
    if (!date_rdv) return alert('La date est obligatoire.');

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/rendezvous/${id}` : '/api/rendezvous';

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ titre, date_rdv, type_rdv, praticien, lieu, notes })
      });
      if (!res.ok) throw new Error();
      closeModal();
      charger();
    } catch {
      alert('Erreur lors de la sauvegarde.');
    }
  }

  // ── Supprimer ────────────────────────────────────────────

  async function supprimer(id) {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    try {
      await fetch(`/api/rendezvous/${id}`, { method: 'DELETE', headers: authHeaders() });
      closeModal();
      charger();
    } catch {
      alert('Erreur lors de la suppression.');
    }
  }

  // ── Liste complète ───────────────────────────────────────

  async function ouvrirListe() {
    try {
      const res  = await fetch('/api/rendezvous', { headers: authHeaders() });
      const rdvs = await res.json();

      const maintenant = new Date();
      const prochains  = rdvs.filter(r => new Date(r.date_rdv) >= maintenant);
      const passes     = rdvs.filter(r => new Date(r.date_rdv) <  maintenant);

      const renderLigne = r => {
        const { label, cls } = joursRestants(r.date_rdv);
        const icon = TYPE_ICONS[r.type_rdv] || '📋';
        return `
          <div class="rdv-liste-item ${cls}">
            <span class="rdv-liste-icon">${icon}</span>
            <div class="rdv-liste-body">
              <strong>${r.titre}</strong>
              <span>${formatDateHeure(r.date_rdv)}</span>
              ${r.praticien ? `<span>Dr. ${r.praticien}</span>` : ''}
            </div>
            <div class="rdv-liste-right">
              <span class="rdv-badge ${cls}">${label}</span>
              <button class="btn-edit-small" onclick="Rendezvous.ouvrirModal(${r.id})">✏️</button>
            </div>
          </div>
        `;
      };

      document.getElementById('modal-title').textContent = '🩺 Tous mes rendez-vous';
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
        </div>
      `;
      document.getElementById('overlay').classList.add('on');
    } catch {
      alert('Erreur de chargement.');
    }
  }

  // ── API publique ─────────────────────────────────────────

  return { charger, ouvrirModal, sauvegarder, supprimer, ouvrirListe };

})();
