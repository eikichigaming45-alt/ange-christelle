// ============================================================
// SUIVI DU CYCLE — cycle.js
// Données strictement privées : jamais exposées à l'admin
// ============================================================

const Cycle = (() => {

  // ── Helpers ──────────────────────────────────────────────

  function authHeaders() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user?.token || ''}`
    };
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  function formatDateInput(date) {
    return new Date(date).toISOString().split('T')[0];
  }

  function memeJour(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  // ── Calculs cycle ────────────────────────────────────────

  function calculerCycle(dernierCycle) {
    if (!dernierCycle) return null;

    const debut       = new Date(dernierCycle.date_debut);
    const dureeRegles = dernierCycle.duree_regles || 5;
    const dureeCycle  = dernierCycle.duree_cycle  || 28;

    const finRegles     = addDays(debut, dureeRegles - 1);
    const prochainDebut = addDays(debut, dureeCycle);
    const debutFertile  = addDays(debut, dureeCycle - 16);
    const finFertile    = addDays(debut, dureeCycle - 12);
    const ovulation     = addDays(debut, dureeCycle - 14);

    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    const joursAvantRegles = Math.ceil((prochainDebut - aujourd_hui) / (1000 * 60 * 60 * 24));
    const enRegles         = aujourd_hui >= debut && aujourd_hui <= finRegles;
    const enFenetre        = aujourd_hui >= debutFertile && aujourd_hui <= finFertile;

    return {
      debut, finRegles, prochainDebut,
      debutFertile, finFertile, ovulation,
      joursAvantRegles, enRegles, enFenetre,
      dureeRegles, dureeCycle
    };
  }

  // ── Phase du cycle ───────────────────────────────────────

  function getPhase(calc) {
    if (!calc) return { label: 'Aucun cycle enregistré', emoji: '❓', color: '#888' };
    if (calc.enRegles)  return { label: 'Règles en cours',   emoji: '🔴', color: '#e74c3c' };
    if (calc.enFenetre) return { label: 'Fenêtre fertile',   emoji: '🟢', color: '#2ecc71' };

    const aujourd_hui = new Date(); aujourd_hui.setHours(0,0,0,0);
    const estOvulation = memeJour(aujourd_hui, calc.ovulation);
    if (estOvulation)   return { label: 'Jour d\'ovulation', emoji: '🌟', color: '#f39c12' };

    return { label: 'Phase de repos', emoji: '🔵', color: '#3498db' };
  }

  // ── Calendrier visuel ────────────────────────────────────

  function renderCalendrier(calc) {
    if (!calc) return '';

    const aujourd_hui = new Date(); aujourd_hui.setHours(0,0,0,0);

    // On affiche le mois du dernier début de règles
    const moisRef  = new Date(calc.debut.getFullYear(), calc.debut.getMonth(), 1);
    const moisNom  = moisRef.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Nombre de jours dans le mois
    const nbJours  = new Date(moisRef.getFullYear(), moisRef.getMonth() + 1, 0).getDate();

    // Jour de la semaine du 1er (0=dim, ajusté lundi=0)
    let premierJour = moisRef.getDay();
    premierJour = premierJour === 0 ? 6 : premierJour - 1;

    const jours = ['L','M','M','J','V','S','D'];

    let cases = '';

    // Cases vides avant le 1er
    for (let i = 0; i < premierJour; i++) {
      cases += `<div class="cal-day cal-empty"></div>`;
    }

    for (let j = 1; j <= nbJours; j++) {
      const date = new Date(moisRef.getFullYear(), moisRef.getMonth(), j);
      date.setHours(0,0,0,0);

      const estAujourdhui  = memeJour(date, aujourd_hui);
      const estRegles      = date >= calc.debut     && date <= calc.finRegles;
      const estFertile     = date >= calc.debutFertile && date <= calc.finFertile;
      const estOvulation   = memeJour(date, calc.ovulation);
      const estProchain    = memeJour(date, calc.prochainDebut);

      let cls  = 'cal-day';
      let badge = '';

      if (estRegles)    cls += ' cal-regles';
      if (estFertile)   cls += ' cal-fertile';
      if (estOvulation) badge = '<span class="cal-ovulation-star">★</span>';
      if (estProchain)  cls += ' cal-prochain';
      if (estAujourdhui) cls += ' cal-today';

      cases += `<div class="${cls}">${j}${badge}</div>`;
    }

    return `
      <div class="cal-wrap">
        <div class="cal-titre">${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)}</div>
        <div class="cal-grid">
          ${jours.map(j => `<div class="cal-head">${j}</div>`).join('')}
          ${cases}
        </div>
        <div class="cal-legende">
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fca5a5"></span> Règles</span>
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fde68a"></span> Fenêtre fertile</span>
          <span class="cal-leg-item"><span style="color:#f59e0b;font-size:14px">★</span> Ovulation</span>
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#4f46e5"></span> Aujourd'hui</span>
        </div>
      </div>
    `;
  }

  // ── Rendu widget ─────────────────────────────────────────

  function renderWidget(cycles) {
    const dernierCycle = cycles.length > 0 ? cycles[0] : null;
    const calc         = calculerCycle(dernierCycle);
    const phase        = getPhase(calc);

    return `
      <div class="widget-cycle">

        <div class="cycle-phase" style="border-left:4px solid ${phase.color}">
          <span class="cycle-phase-emoji">${phase.emoji}</span>
          <div>
            <div class="cycle-phase-label">${phase.label}</div>
            ${calc ? `<div class="cycle-phase-sub">
              ${calc.enRegles
                ? `Fin estimée le ${formatDate(calc.finRegles)}`
                : calc.joursAvantRegles > 0
                  ? `Prochaines règles dans <strong>${calc.joursAvantRegles} jour${calc.joursAvantRegles > 1 ? 's' : ''}</strong>`
                  : `Règles attendues aujourd'hui`
              }
            </div>` : ''}
          </div>
        </div>

        ${calc ? `
        <div class="cycle-infos">
          <div class="cycle-info-item">
            <span class="cycle-info-icon">📅</span>
            <div>
              <div class="cycle-info-label">Dernier début</div>
              <div class="cycle-info-value">${formatDate(calc.debut)}</div>
            </div>
          </div>
          <div class="cycle-info-item">
            <span class="cycle-info-icon">🌿</span>
            <div>
              <div class="cycle-info-label">Fenêtre fertile</div>
              <div class="cycle-info-value">${formatDate(calc.debutFertile)} → ${formatDate(calc.finFertile)}</div>
            </div>
          </div>
          <div class="cycle-info-item">
            <span class="cycle-info-icon">✨</span>
            <div>
              <div class="cycle-info-label">Ovulation estimée</div>
              <div class="cycle-info-value">${formatDate(calc.ovulation)}</div>
            </div>
          </div>
          <div class="cycle-info-item">
            <span class="cycle-info-icon">🔄</span>
            <div>
              <div class="cycle-info-label">Prochain cycle</div>
              <div class="cycle-info-value">${formatDate(calc.prochainDebut)}</div>
            </div>
          </div>
        </div>

        <div class="cycle-progress-wrap">
          <div class="cycle-progress-label">Progression du cycle (${calc.dureeCycle} jours)</div>
          <div class="cycle-progress-bar">
            <div class="cycle-progress-fill" style="width:${Math.min(100, Math.max(0, Math.round(((new Date() - calc.debut) / (1000 * 60 * 60 * 24)) / calc.dureeCycle * 100)))}%;background:${phase.color}"></div>
          </div>
        </div>
        ` : ''}

        <div class="cycle-actions">
          <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">
            + Enregistrer mes règles
          </button>
          ${cycles.length > 0 ? `
          <button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">
            Historique (${cycles.length})
          </button>` : ''}
        </div>

      </div>
    `;
  }

  // ── Chargement principal ─────────────────────────────────

  async function charger() {
    const container = document.getElementById('widget-cycle-content');
    if (!container) return;
    try {
      const res    = await fetch('/api/cycle', { headers: authHeaders() });
      const cycles = await res.json();
      container.innerHTML = renderWidget(Array.isArray(cycles) ? cycles : []);
    } catch (e) {
      container.innerHTML = `<p class="cycle-error">Erreur de chargement du cycle.</p>`;
    }
  }

  // ── Modal principale avec calendrier ─────────────────────

  async function ouvrirModalCalendrier() {
    try {
      const res    = await fetch('/api/cycle', { headers: authHeaders() });
      const cycles = await res.json();
      const dernierCycle = Array.isArray(cycles) && cycles.length > 0 ? cycles[0] : null;
      const calc   = calculerCycle(dernierCycle);
      const phase  = getPhase(calc);

      document.getElementById('modal-title').textContent = '🌸 Suivi du cycle';
      document.getElementById('modal-body').innerHTML = `
        <div class="modal-cycle-main">

          ${calc ? `
          <div class="cycle-phase" style="border-left:4px solid ${phase.color};margin-bottom:16px">
            <span class="cycle-phase-emoji">${phase.emoji}</span>
            <div>
              <div class="cycle-phase-label">${phase.label}</div>
              <div class="cycle-phase-sub">
                ${calc.enRegles
                  ? `Fin estimée le ${formatDate(calc.finRegles)}`
                  : calc.joursAvantRegles > 0
                    ? `Prochaines règles dans <strong>${calc.joursAvantRegles} jour${calc.joursAvantRegles > 1 ? 's' : ''}</strong>`
                    : `Règles attendues aujourd'hui`
                }
              </div>
            </div>
          </div>
          ` : '<p style="color:#9ca3af;margin-bottom:16px">Aucun cycle enregistré.</p>'}

          ${renderCalendrier(calc)}

          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">
              + Enregistrer mes règles
            </button>
            ${cycles.length > 0 ? `
            <button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">
              Historique (${cycles.length})
            </button>` : ''}
          </div>

        </div>
      `;
      document.getElementById('overlay').classList.add('on');
    } catch {
      alert('Erreur de chargement.');
    }
  }

  // ── Modal : Ajouter / Modifier un cycle ──────────────────

  function ouvrirModalAjout(cycleExistant = null) {
    const isEdit = !!cycleExistant;
    const today  = formatDateInput(new Date());

    document.getElementById('modal-title').textContent = isEdit ? '✏️ Modifier le cycle' : '🌸 Enregistrer mes règles';
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-cycle-form">
        <label>Date de début des règles *</label>
        <input type="date" id="cycle-date-debut"
          value="${isEdit ? formatDateInput(cycleExistant.date_debut) : today}"
          max="${today}" />

        <label>Durée des règles (jours)</label>
        <input type="number" id="cycle-duree-regles" min="1" max="10"
          value="${isEdit ? cycleExistant.duree_regles : 5}" />

        <label>Durée du cycle (jours)</label>
        <input type="number" id="cycle-duree-cycle" min="21" max="45"
          value="${isEdit ? cycleExistant.duree_cycle : 28}" />

        <label>Notes (optionnel)</label>
        <textarea id="cycle-notes" rows="3" placeholder="Douleurs, humeur, symptômes...">${isEdit ? (cycleExistant.notes || '') : ''}</textarea>

        <div class="modal-actions">
          <button class="btn-save" onclick="Cycle.sauvegarder(${isEdit ? cycleExistant.id : 'null'})">
            ${isEdit ? 'Modifier' : 'Enregistrer'}
          </button>
          ${isEdit ? `<button class="btn-delete" onclick="Cycle.supprimer(${cycleExistant.id})">Supprimer</button>` : ''}
          <button class="btn-cancel" onclick="closeModal()">Annuler</button>
        </div>
      </div>
    `;
    document.getElementById('overlay').classList.add('on');
  }

  // ── Sauvegarder ──────────────────────────────────────────

  async function sauvegarder(id = null) {
    const date_debut   = document.getElementById('cycle-date-debut').value;
    const duree_regles = parseInt(document.getElementById('cycle-duree-regles').value);
    const duree_cycle  = parseInt(document.getElementById('cycle-duree-cycle').value);
    const notes        = document.getElementById('cycle-notes').value;

    if (!date_debut) return alert('La date de début est obligatoire.');

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/cycle/${id}` : '/api/cycle';

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({ date_debut, duree_regles, duree_cycle, notes })
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
    if (!confirm('Supprimer ce cycle ?')) return;
    try {
      await fetch(`/api/cycle/${id}`, { method: 'DELETE', headers: authHeaders() });
      closeModal();
      charger();
    } catch {
      alert('Erreur lors de la suppression.');
    }
  }

  // ── Historique ───────────────────────────────────────────

  async function ouvrirHistorique() {
    try {
      const res    = await fetch('/api/cycle', { headers: authHeaders() });
      const cycles = await res.json();

      const lignes = cycles.map(c => `
        <div class="cycle-historique-item">
          <div>
            <strong>${formatDate(c.date_debut)}</strong>
            <span class="cycle-histo-detail">Règles : ${c.duree_regles}j — Cycle : ${c.duree_cycle}j</span>
            ${c.notes ? `<span class="cycle-histo-notes">${c.notes}</span>` : ''}
          </div>
          <button class="btn-edit-small" onclick="Cycle.ouvrirModalAjout(${JSON.stringify(c).replace(/"/g, '&quot;')})">✏️</button>
        </div>
      `).join('');

      document.getElementById('modal-title').textContent = '📋 Historique des cycles';
      document.getElementById('modal-body').innerHTML = `
        <div class="cycle-historique">
          ${lignes || '<p>Aucun cycle enregistré.</p>'}
          <button class="btn-cycle-primary" style="margin-top:12px" onclick="Cycle.ouvrirModalAjout()">+ Nouveau cycle</button>
        </div>
      `;
      document.getElementById('overlay').classList.add('on');
    } catch {
      alert('Erreur de chargement de l\'historique.');
    }
  }

  // ── API publique ─────────────────────────────────────────

  return { charger, ouvrirModalAjout, ouvrirModalCalendrier, sauvegarder, supprimer, ouvrirHistorique };

})();
