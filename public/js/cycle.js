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
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  function formatDateInput(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function memeJour(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  function confirmerAction(message, onOui) {
    document.getElementById('modal-title').textContent = '🌸 Confirmation';
    document.getElementById('modal-body').innerHTML = `
      <p style="color:#333;font-size:15px;margin-bottom:20px">${message}</p>
      <div class="modal-actions">
        <button class="btn-delete" id="btn-confirmer-oui">Confirmer</button>
        <button class="btn-cancel" id="btn-confirmer-non">Annuler</button>
      </div>
    `;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-confirmer-oui').onclick = () => onOui();
    document.getElementById('btn-confirmer-non').onclick = () => closeModal();
  }

  // ── Calcul automatique durée cycle ───────────────────────

  function calculerDureeMoyenne(cycles) {
    if (cycles.length < 2) return null;
    const durees = [];
    for (let i = 0; i < cycles.length - 1; i++) {
      const a = new Date(cycles[i].date_debut);
      const b = new Date(cycles[i + 1].date_debut);
      const diff = Math.round((a - b) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff < 60) durees.push(diff);
    }
    if (durees.length === 0) return null;
    return Math.round(durees.reduce((a, b) => a + b, 0) / durees.length);
  }

  // ── State navigation calendrier ──────────────────────────

  let _calcCourant = null;
  let _moisAffiche = null;
  let _journalCache = {};

  // ── Calculs cycle ────────────────────────────────────────

  function calculerCycle(dernierCycle, dureeMoyenne) {
    if (!dernierCycle) return null;

    const debut       = new Date(dernierCycle.date_debut);
    debut.setHours(0, 0, 0, 0);
    const dureeRegles = dernierCycle.duree_regles || 5;
    const dureeCycle  = dureeMoyenne || dernierCycle.duree_cycle || 28;

    const finRegles       = addDays(debut, dureeRegles - 1);
    const prochainDebut   = addDays(debut, dureeCycle);
    const debutFertile    = addDays(debut, dureeCycle - 16);
    const finFertile      = addDays(debut, dureeCycle - 12);
    const ovulation       = addDays(debut, dureeCycle - 14);

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
    if (memeJour(aujourd_hui, calc.ovulation)) return { label: 'Jour d\'ovulation', emoji: '🌟', color: '#f39c12' };

    return { label: 'Phase de repos', emoji: '🔵', color: '#3498db' };
  }

  // ── Chargement journal du mois ───────────────────────────

  async function chargerJournal(mois, annee) {
    try {
      const res = await fetch(`/api/cycle/journal?mois=${mois}&annee=${annee}`, { headers: authHeaders() });
      const rows = await res.json();
      _journalCache = {};
      rows.forEach(r => {
        const key = r.date.split('T')[0];
        _journalCache[key] = r;
      });
    } catch {
      _journalCache = {};
    }
  }

  // ── Calendrier visuel ────────────────────────────────────

  function renderCalendrier(calc) {
    if (!calc) return '';

    const aujourd_hui = new Date(); aujourd_hui.setHours(0,0,0,0);
    const moisRef     = new Date(_moisAffiche.getFullYear(), _moisAffiche.getMonth(), 1);
    const moisNom     = moisRef.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const nbJours     = new Date(moisRef.getFullYear(), moisRef.getMonth() + 1, 0).getDate();

    let premierJour = moisRef.getDay();
    premierJour = premierJour === 0 ? 6 : premierJour - 1;

    const jours = ['L','M','M','J','V','S','D'];
    let cases   = '';

    for (let i = 0; i < premierJour; i++) {
      cases += `<div class="cal-day cal-empty" onclick="event.stopPropagation()"></div>`;
    }

    for (let j = 1; j <= nbJours; j++) {
      const date = new Date(moisRef.getFullYear(), moisRef.getMonth(), j);
      date.setHours(0,0,0,0);
      const dateStr = formatDateInput(date);

      const estAujourdhui = memeJour(date, aujourd_hui);
      const estRegles     = date >= calc.debut && date <= calc.finRegles;
      const estFertile    = date >= calc.debutFertile && date <= calc.finFertile;
      const estOvulation  = memeJour(date, calc.ovulation);
      const estProchain   = memeJour(date, calc.prochainDebut);
      const estProchainesRegles = date >= calc.prochainDebut && date <= addDays(calc.prochainDebut, calc.dureeRegles - 1);

      const journal   = _journalCache[dateStr];
      const aRapport  = journal?.humeur === 'protege' || journal?.humeur === 'non_protege';
      const aSymptomes = journal?.symptomes;

      let cls   = 'cal-day';
      let badge = '';
      let icons = '';

      if (estRegles || estProchainesRegles) cls += ' cal-regles';
	  else if (estFertile)                  cls += ' cal-fertile';
      if (estAujourdhui)  cls += ' cal-today';
      if (estOvulation)   badge = '<span class="cal-ovulation-star">★</span>';
      if (aRapport)       icons += `<span class="cal-icon-rapport ${journal.humeur === 'protege' ? 'protege' : 'non-protege'}">♥</span>`;
      if (aSymptomes)     icons += `<span class="cal-icon-symptome">●</span>`;

      cases += `<div class="${cls}" onclick="Cycle.ouvrirJournal('${dateStr}')">${j}${badge}${icons ? `<div class="cal-day-icons">${icons}</div>` : ''}</div>`;
    }

    return `
      <div class="cal-wrap">
        <div class="cal-nav">
          <button class="cal-nav-btn" onclick="Cycle.naviguerCalendrier(-1)">&#8249;</button>
          <div class="cal-titre">${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)}</div>
          <button class="cal-nav-btn" onclick="Cycle.naviguerCalendrier(1)">&#8250;</button>
        </div>
        <div class="cal-grid">
          ${jours.map(j => `<div class="cal-head">${j}</div>`).join('')}
          ${cases}
        </div>
        <div class="cal-legende">
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fca5a5"></span> Règles</span>
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fde68a"></span> Fertile</span>
          <span class="cal-leg-item"><span style="color:#f59e0b;font-size:14px">★</span> Ovulation</span>
          <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#4f46e5"></span> Aujourd'hui</span>
          <span class="cal-leg-item"><span style="color:#e83e8c">♥</span> Rapport</span>
          <span class="cal-leg-item"><span style="color:#7c3aed">●</span> Symptômes</span>
        </div>
      </div>
    `;
  }

  // ── Navigation calendrier ────────────────────────────────

  async function naviguerCalendrier(offset) {
    if (!_calcCourant || !_moisAffiche) return;
    _moisAffiche = new Date(_moisAffiche.getFullYear(), _moisAffiche.getMonth() + offset, 1);
    await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
    const container = document.getElementById('cal-container');
    if (container) container.innerHTML = renderCalendrier(_calcCourant);
  }

  // ── Modal journal (clic sur un jour) ─────────────────────

  async function ouvrirJournal(dateStr) {
    const journal = _journalCache[dateStr] || {};
    const dateAff = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const symptomesActifs = journal.symptomes ? journal.symptomes.split(',') : [];

    const SYMPTOMES = [
      { key: 'douleur_pelvienne',    label: 'Douleur pelvienne' },
      { key: 'pertes_claires',       label: 'Pertes claires' },
      { key: 'glaire_cervicale',     label: 'Glaire cervicale' },
      { key: 'sensibilite_poitrine', label: 'Sensibilité poitrine' },
    ];

    document.getElementById('modal-title').textContent = `📅 ${dateAff}`;
    document.getElementById('modal-body').innerHTML = `
      <div class="journal-form">
        <div class="journal-section-title">Rapport sexuel</div>
        <div class="journal-rapport-btns">
          <button class="btn-rapport ${journal.humeur === 'protege' ? 'active' : ''}"
            onclick="Cycle._toggleRapport(this)">🛡️ Protégé</button>
          <button class="btn-rapport ${journal.humeur === 'non_protege' ? 'active' : ''}"
            onclick="Cycle._toggleRapport(this)">♥ Non protégé</button>
        </div>

        <div class="journal-section-title" style="margin-top:14px">Symptômes</div>
        <div class="journal-symptomes">
          ${SYMPTOMES.map(s => `
            <label class="symptome-check">
              <input type="checkbox" value="${s.key}" ${symptomesActifs.includes(s.key) ? 'checked' : ''}>
              ${s.label}
            </label>
          `).join('')}
        </div>

        <div class="journal-section-title" style="margin-top:14px">Notes libres</div>
        <textarea id="journal-notes" rows="3" placeholder="Autre chose à noter...">${journal.notes || ''}</textarea>

        <div class="modal-actions" style="margin-top:16px">
          <button class="btn-save" onclick="Cycle._sauvegarderJournal('${dateStr}')">💾 Sauvegarder</button>
          ${journal.id ? `<button class="btn-delete" onclick="Cycle._supprimerJournal(${journal.id}, '${dateStr}')">🗑️ Supprimer</button>` : ''}
          <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Annuler</button>
        </div>
      </div>
    `;
    document.getElementById('overlay').classList.add('on');
  }

  function _toggleRapport(btn) {
    const estDejaActif = btn.classList.contains('active');
    document.querySelectorAll('.btn-rapport').forEach(b => b.classList.remove('active'));
    if (!estDejaActif) btn.classList.add('active');
  }

  async function _sauvegarderJournal(dateStr) {
    const rapportBtn = document.querySelector('.btn-rapport.active');
    const rapport    = rapportBtn
      ? (rapportBtn.textContent.includes('Protégé') ? 'protege' : 'non_protege')
      : null;
    const symptomes  = [...document.querySelectorAll('.journal-symptomes input:checked')].map(i => i.value).join(',');
    const notes      = document.getElementById('journal-notes').value;

    try {
      await fetch('/api/cycle/journal', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date: dateStr, rapport, symptomes, notes })
      });
      await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
      ouvrirModalCalendrier();
    } catch {
      alert('Erreur lors de la sauvegarde.');
    }
  }

  async function _supprimerJournal(id, dateStr) {
    const dateAff = new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
    confirmerAction(`Supprimer l'entrée du <strong>${dateAff}</strong> ?`, async () => {
      try {
        await fetch(`/api/cycle/journal/${id}`, { method: 'DELETE', headers: authHeaders() });
        await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
        ouvrirModalCalendrier();
      } catch {
        alert('Erreur lors de la suppression.');
      }
    });
  }

  // ── Rendu widget ─────────────────────────────────────────

  function renderWidget(cycles, dureeMoyenne) {
    const dernierCycle = cycles.length > 0 ? cycles[0] : null;
    const calc         = calculerCycle(dernierCycle, dureeMoyenne);
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
            <span class="cycle-info-icon">🔄</span>
            <div>
              <div class="cycle-info-label">Durée cycle ${dureeMoyenne ? '(calculée)' : '(estimée)'}</div>
              <div class="cycle-info-value">${calc.dureeCycle} jours</div>
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

    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.token) {
      setTimeout(() => charger(), 300);
      return;
    }

    try {
      const res    = await fetch('/api/cycle', { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const cycles = await res.json();
      const dureeMoyenne = calculerDureeMoyenne(Array.isArray(cycles) ? cycles : []);
      container.innerHTML = renderWidget(Array.isArray(cycles) ? cycles : [], dureeMoyenne);
    } catch (e) {
      container.innerHTML = `<p class="cycle-error">Erreur de chargement du cycle.</p>`;
    }
  }

  // ── Modal principale avec calendrier ─────────────────────

  async function ouvrirModalCalendrier() {
    try {
      const res          = await fetch('/api/cycle', { headers: authHeaders() });
      const cycles       = await res.json();
      const dureeMoyenne = calculerDureeMoyenne(Array.isArray(cycles) ? cycles : []);
      const dernierCycle = Array.isArray(cycles) && cycles.length > 0 ? cycles[0] : null;
      const calc         = calculerCycle(dernierCycle, dureeMoyenne);
      const phase        = getPhase(calc);

      _calcCourant = calc;
      _moisAffiche = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());

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

          ${dureeMoyenne ? `<div class="cycle-duree-info">Durée moyenne calculée : <strong>${dureeMoyenne} jours</strong> (sur ${cycles.length} cycles)</div>` : ''}

          <div id="cal-container">${renderCalendrier(calc)}</div>

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
	  document.querySelector('.mclos').onclick = () => Cycle.ouvrirModalCalendrier();
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

        <label>Durée du cycle (jours) — sera recalculée automatiquement après 2 cycles</label>
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

  // ── Supprimer cycle ───────────────────────────────────────

  async function supprimer(id) {
    confirmerAction('Supprimer ce cycle ? Cette action est irréversible.', async () => {
      try {
        await fetch(`/api/cycle/${id}`, { method: 'DELETE', headers: authHeaders() });
        closeModal();
        charger();
      } catch {
        alert('Erreur lors de la suppression.');
      }
    });
  }

  // ── Historique ───────────────────────────────────────────

  async function ouvrirHistorique() {
    try {
      const res          = await fetch('/api/cycle', { headers: authHeaders() });
      const cycles       = await res.json();
      const dureeMoyenne = calculerDureeMoyenne(cycles);

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
          ${dureeMoyenne ? `<div class="cycle-duree-info" style="margin-bottom:12px">Durée moyenne calculée : <strong>${dureeMoyenne} jours</strong></div>` : ''}
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

  return { charger, ouvrirModalAjout, ouvrirModalCalendrier, naviguerCalendrier, sauvegarder, supprimer, ouvrirHistorique, ouvrirJournal, _toggleRapport, _sauvegarderJournal, _supprimerJournal };

})();
