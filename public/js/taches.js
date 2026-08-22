// ============================================================
// public/js/taches.js
// Authentification : JWT Bearer uniquement.
// B.6 — après suppression/modification : retour vue courante.
// Message suppression iso : "Confirmer la suppression ?"
// ============================================================

function _todayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function _formatDateTache(dateStr) {
    if (!dateStr) return 'Sans date';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
        weekday: 'short', day: '2-digit', month: 'short'
    });
}

function _optionsRappel(selected = 0) {
    return [
        { v: 0,    l: 'Pas de rappel' },
        { v: 15,   l: '15 min avant' },
        { v: 30,   l: '30 min avant' },
        { v: 60,   l: '1h avant' },
        { v: 120,  l: '2h avant' },
        { v: 1440, l: 'La veille' },
    ].map(o => `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
}

function _formatRappelTache(minutes) {
    if (!minutes || minutes === 0) return '';
    if (minutes === 1440) return 'La veille';
    if (minutes >= 60)    return `${minutes / 60}h avant`;
    return `${minutes} min avant`;
}

async function chargerWidgetTaches() {
    const user = getUser();
    if (!user?.token) return;
    const el = document.getElementById('wc-taches');
    if (!el) return;
    try {
        const r = await fetch('/api/taches', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        const today      = _todayStr();
        const taches     = d.taches;
        const duJour     = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] === today);
        const avenir     = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] > today).slice(0, 3);
        const flottantes = taches.filter(t => !t.faite && !t.date).slice(0, 2);
        if (!duJour.length && !avenir.length && !flottantes.length) {
            el.innerHTML = '<p class="rdv-empty">Aucune tâche à venir</p>';
            return;
        }
        let html = '<div class="tache-widget-liste">';
        if (duJour.length) {
            html += `<div class="tache-widget-section">Aujourd'hui (${duJour.length})</div>`;
            html += duJour.map(t => `
                <div class="tache-widget-item">
                    <span class="tache-widget-dot tache-dot-today"></span>
                    <span class="tache-widget-titre">${t.titre}</span>
                </div>`).join('');
        }
        if (avenir.length) {
            html += `<div class="tache-widget-section">À venir</div>`;
            html += avenir.map(t => `
                <div class="tache-widget-item">
                    <span class="tache-widget-dot tache-dot-futur"></span>
                    <span class="tache-widget-titre">${t.titre}</span>
                    <span class="tache-widget-date">${_formatDateTache(t.date?.split('T')[0])}</span>
                </div>`).join('');
        }
        if (flottantes.length) {
            html += `<div class="tache-widget-section">Sans date</div>`;
            html += flottantes.map(t => `
                <div class="tache-widget-item">
                    <span class="tache-widget-dot tache-dot-flott"></span>
                    <span class="tache-widget-titre">${t.titre}</span>
                </div>`).join('');
        }
        html += '</div>';
        el.innerHTML = html;
    } catch { if (el) el.innerHTML = '<p class="rdv-error">Erreur de chargement</p>'; }
}

async function chargerModalTaches() {
    const user = getUser();
    const r = await fetch('/api/taches', {
        headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const d = await r.json();
    if (!d.success) return;
    const today    = _todayStr();
    const taches   = d.taches;
    const duJour   = taches.filter(t => t.date && t.date.split('T')[0] === today);
    const avenir   = taches.filter(t => t.date && t.date.split('T')[0] > today && !t.faite);
    const flott    = taches.filter(t => !t.date && !t.faite);
    const termines = taches.filter(t => t.faite).slice(0, 5);
    document.getElementById('modal-title').textContent = 'Tâches du jour';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom:16px">
            <div class="form-row">
                <input type="text" id="t-titre" placeholder="Titre de la tâche">
            </div>
            <div class="form-row">
                <input type="date" id="t-date">
                <input type="time" id="t-heure">
                <select id="t-recur">
                    <option value="none">Une fois</option>
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdo</option>
                    <option value="monthly">Mensuel</option>
                </select>
            </div>
            <div class="form-row">
                <select id="t-rappel" style="width:100%">${_optionsRappel(0)}</select>
            </div>
            <button class="add-btn" onclick="ajouterTache()">➕ Ajouter la tâche</button>
        </div>
        ${duJour.length   ? `<div class="section-title">Aujourd'hui</div>${duJour.map(t => renderTache(t, today)).join('')}`   : ''}
        ${avenir.length   ? `<div class="section-title">À venir</div>${avenir.map(t => renderTache(t, today)).join('')}`       : ''}
        ${flott.length    ? `<div class="section-title">Sans date</div>${flott.map(t => renderTache(t, today)).join('')}`      : ''}
        ${termines.length ? `<div class="section-title">Terminées</div>${termines.map(t => renderTache(t, today)).join('')}`   : ''}
        ${!taches.length  ? '<p style="color:#9ca3af;text-align:center;margin-top:20px">Aucune tâche pour l\'instant</p>'     : ''}
    `;
}

function renderTache(t, today) {
    const dateStr    = t.date ? t.date.split('T')[0] : null;
    const heureStr   = t.heure ? t.heure.slice(0, 5) : '';
    const isToday    = dateStr === today;
    const recuLabels = { daily: 'Quotidien', weekly: 'Hebdo', monthly: 'Mensuel' };
    const rappelLabel = t.rappel_avant > 0
        ? `<span class="badge-recur">⏰ ${_formatRappelTache(t.rappel_avant)}</span>` : '';
    return `
        <div class="liste-item ${t.faite ? 'faite' : ''}" id="tache-${t.id}">
            <div class="item-check ${t.faite ? 'checked' : ''}" onclick="cocherTache(${t.id})">
                ${t.faite ? '✓' : ''}
            </div>
            <div class="item-info">
                <div class="item-titre">
                    ${t.titre}
                    ${isToday && !t.faite ? '<span class="badge-today">Aujourd\'hui</span>' : ''}
                    ${t.recurrence !== 'none' ? `<span class="badge-recur">${recuLabels[t.recurrence]}</span>` : ''}
                    ${rappelLabel}
                </div>
                <div class="item-meta">
                    ${dateStr ? _formatDateTache(dateStr) : 'Sans date'}
                    ${heureStr ? ' à ' + heureStr : ''}
                </div>
            </div>
            <button class="btn-edit-small" onclick="modifierTache(${t.id})">✏️</button>
            <button class="item-del"       onclick="supprimerTache(${t.id})">🗑️</button>
        </div>`;
}

async function ajouterTache() {
    const user  = getUser();
    const titre = document.getElementById('t-titre').value.trim();
    if (!titre) {
        document.getElementById('modal-title').textContent = 'Champ manquant';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Le titre est obligatoire.</p>
            <div class="modal-actions"><button class="btn-cancel" onclick="chargerModalTaches()">Retour</button></div>`;
        return;
    }
    const body = {
        titre,
        date        : document.getElementById('t-date').value  || null,
        heure       : document.getElementById('t-heure').value || null,
        recurrence  : document.getElementById('t-recur').value,
        rappel_avant: parseInt(document.getElementById('t-rappel').value) || 0
    };
    try {
        const r = await fetch('/api/taches', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
            body   : JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) { chargerModalTaches(); chargerWidgetTaches(); }
        else {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur : ${d.message}</p>
                <div class="modal-actions"><button class="btn-cancel" onclick="chargerModalTaches()">Retour</button></div>`;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur réseau';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions"><button class="btn-cancel" onclick="chargerModalTaches()">Retour</button></div>`;
    }
}

async function modifierTache(id) {
    const user = getUser();
    const r    = await fetch('/api/taches', {
        headers: { 'Authorization': `Bearer ${user.token}` }
    });
    const d = await r.json();
    if (!d.success) return;
    const t = d.taches.find(t => t.id === id);
    if (!t) return;
    const dateVal   = t.date  ? t.date.split('T')[0] : '';
    const heureVal  = t.heure ? t.heure.slice(0, 5)  : '';
    const rappelVal = t.rappel_avant || 0;
    document.getElementById('modal-title').textContent = 'Modifier la tâche';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom:16px">
            <div class="form-row">
                <input type="text" id="t-titre-edit" value="${t.titre}" placeholder="Titre de la tâche">
            </div>
            <div class="form-row">
                <input type="date"  id="t-date-edit"  value="${dateVal}">
                <input type="time"  id="t-heure-edit" value="${heureVal}">
                <select id="t-recur-edit">
                    <option value="none"    ${t.recurrence==='none'    ? 'selected':''}>Une fois</option>
                    <option value="daily"   ${t.recurrence==='daily'   ? 'selected':''}>Quotidien</option>
                    <option value="weekly"  ${t.recurrence==='weekly'  ? 'selected':''}>Hebdo</option>
                    <option value="monthly" ${t.recurrence==='monthly' ? 'selected':''}>Mensuel</option>
                </select>
            </div>
            <div class="form-row">
                <select id="t-rappel-edit" style="width:100%">${_optionsRappel(rappelVal)}</select>
            </div>
            <div class="modal-actions" style="margin-top:12px">
                <button class="btn-save"   onclick="sauvegarderModifTache(${id})">💾 Sauvegarder</button>
                <button class="btn-cancel" onclick="chargerModalTaches()">Annuler</button>
            </div>
        </div>`;
}

async function sauvegarderModifTache(id) {
    const user  = getUser();
    const titre = document.getElementById('t-titre-edit').value.trim();
    if (!titre) {
        document.getElementById('modal-title').textContent = 'Champ manquant';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Le titre est obligatoire.</p>
            <div class="modal-actions"><button class="btn-cancel" onclick="modifierTache(${id})">Retour</button></div>`;
        return;
    }
    const body = {
        titre,
        date        : document.getElementById('t-date-edit').value  || null,
        heure       : document.getElementById('t-heure-edit').value || null,
        recurrence  : document.getElementById('t-recur-edit').value,
        rappel_avant: parseInt(document.getElementById('t-rappel-edit').value) || 0
    };
    try {
        const r = await fetch(`/api/taches/${id}`, {
            method : 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
            body   : JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) { chargerModalTaches(); chargerWidgetTaches(); }
        else {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur : ${d.message}</p>
                <div class="modal-actions"><button class="btn-cancel" onclick="modifierTache(${id})">Retour</button></div>`;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur réseau';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions"><button class="btn-cancel" onclick="modifierTache(${id})">Retour</button></div>`;
    }
}

async function cocherTache(id) {
    const user = getUser();
    try {
        await fetch(`/api/taches/${id}/cocher`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` }
        });
        chargerModalTaches();
        chargerWidgetTaches();
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur réseau';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions"><button class="btn-cancel" onclick="chargerModalTaches()">Retour</button></div>`;
    }
}

async function supprimerTache(id) {
    const user = getUser();
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
        <div class="modal-actions">
            <button class="btn-delete" id="btn-tache-oui">Confirmer</button>
            <button class="btn-cancel" id="btn-tache-non">Annuler</button>
        </div>`;
    document.getElementById('btn-tache-oui').onclick = async () => {
        try {
            await fetch(`/api/taches/${id}`, {
                method : 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            chargerModalTaches();
            chargerWidgetTaches();
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur réseau';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
                <div class="modal-actions"><button class="btn-cancel" onclick="chargerModalTaches()">Retour</button></div>`;
        }
    };
    document.getElementById('btn-tache-non').onclick = () => chargerModalTaches();
}
