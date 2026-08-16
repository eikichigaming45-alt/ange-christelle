// ===================== WIDGET & MODALE TACHES =====================

async function chargerWidgetTaches() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    const el = document.getElementById('wc-taches');
    if (!el) return;
    try {
        const r = await fetch(`/api/taches?userId=${user.userId}`);
        const d = await r.json();
        if (!d.success) return;
        const today = new Date();
        const annee = today.getFullYear();
        const mois  = String(today.getMonth()+1).padStart(2,'0');
        const jour  = String(today.getDate()).padStart(2,'0');
        const todayStr = `${annee}-${mois}-${jour}`;
        const taches = d.taches;
        const duJour    = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] === todayStr);
        const avenir    = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] > todayStr).slice(0,3);
        const flottantes = taches.filter(t => !t.faite && !t.date).slice(0,2);
        if (duJour.length === 0 && avenir.length === 0 && flottantes.length === 0) {
            el.textContent = 'Aucune tâche à venir';
            return;
        }
        let html = '';
        if (duJour.length > 0) html += `<strong style="font-size:12px;color:#059669">Aujourd'hui (${duJour.length})</strong><br>${duJour.map(t=>`• ${t.titre}`).join('<br>')}`;
        if (avenir.length > 0) html += `${duJour.length?'<br>':''}<strong style="font-size:12px;color:#6b7280">À venir</strong><br>${avenir.map(t=>`• ${t.titre} <span style="color:#9ca3af;font-size:11px">${new Date(t.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>`).join('<br>')}`;
        if (flottantes.length > 0) html += `<br><strong style="font-size:12px;color:#6b7280">Sans date</strong><br>${flottantes.map(t=>`• ${t.titre}`).join('<br>')}`;
        el.innerHTML = html;
    } catch(e) { if(el) el.textContent = 'Erreur de chargement'; }
}

async function chargerModalTaches() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/taches?userId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;

    const today = new Date();
    const annee = today.getFullYear();
    const mois  = String(today.getMonth()+1).padStart(2,'0');
    const jour  = String(today.getDate()).padStart(2,'0');
    const todayStr = `${annee}-${mois}-${jour}`;

    const taches   = d.taches;
    const duJour   = taches.filter(t => t.date && t.date.split('T')[0] === todayStr);
    const avenir   = taches.filter(t => t.date && t.date.split('T')[0] > todayStr && !t.faite);
    const flott    = taches.filter(t => !t.date && !t.faite);
    const termines = taches.filter(t => t.faite).slice(0,5);

    document.getElementById('modal-title').textContent = '✅ Tâches du jour';
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
                <select id="t-rappel" style="width:100%">
                    <option value="0">Pas de rappel anticipé</option>
                    <option value="5">5 min avant</option>
                    <option value="10">10 min avant</option>
                    <option value="15">15 min avant</option>
                    <option value="30">30 min avant</option>
                    <option value="60">1h avant</option>
                </select>
            </div>
            <button class="add-btn" onclick="ajouterTache()">➕ Ajouter la tâche</button>
        </div>

        ${duJour.length > 0 ? `<div class="section-title">Aujourd'hui</div>${duJour.map(t => renderTache(t, todayStr)).join('')}` : ''}
        ${avenir.length > 0 ? `<div class="section-title">À venir</div>${avenir.map(t => renderTache(t, todayStr)).join('')}` : ''}
        ${flott.length  > 0 ? `<div class="section-title">Sans date</div>${flott.map(t => renderTache(t, todayStr)).join('')}` : ''}
        ${termines.length > 0 ? `<div class="section-title">Terminées</div>${termines.map(t => renderTache(t, todayStr)).join('')}` : ''}
        ${taches.length === 0 ? '<p style="color:#9ca3af;text-align:center;margin-top:20px">Aucune tâche pour l\'instant</p>' : ''}
    `;
}

function renderTache(t, today) {
    const dateStr  = t.date ? t.date.split('T')[0] : null;
    const heureStr = t.heure ? t.heure.slice(0,5) : '';
    const isToday  = dateStr === today;
    const recuLabels = { daily:'Quotidien', weekly:'Hebdo', monthly:'Mensuel' };
    const rappelLabel = t.rappel_avant && t.rappel_avant > 0
        ? `<span class="badge-recur">⏰ ${t.rappel_avant >= 60 ? '1h' : t.rappel_avant+'min'} avant</span>`
        : '';
    return `
        <div class="liste-item ${t.faite?'faite':''}" id="tache-${t.id}">
            <div class="item-check ${t.faite?'checked':''}" onclick="cocherTache(${t.id})">
                ${t.faite?'✓':''}
            </div>
            <div class="item-info">
                <div class="item-titre">
                    ${t.titre}
                    ${isToday && !t.faite ? '<span class="badge-today">Aujourd\'hui</span>' : ''}
                    ${t.recurrence !== 'none' ? `<span class="badge-recur">${recuLabels[t.recurrence]}</span>` : ''}
                    ${rappelLabel}
                </div>
                <div class="item-meta">
                    ${dateStr ? new Date(dateStr+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'}) : 'Sans date'}
                    ${heureStr ? ' à '+heureStr : ''}
                </div>
            </div>
            <button class="item-edit" onclick="modifierTache(${t.id})" title="Modifier">✏️</button>
            <button class="item-del"  onclick="supprimerTache(${t.id})" title="Supprimer">🗑️</button>
        </div>
    `;
}

async function ajouterTache() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const titre = document.getElementById('t-titre').value.trim();
    if (!titre) { alert('Entrez un titre'); return; }
    const body = {
        userId     : user.userId,
        titre,
        date       : document.getElementById('t-date').value || null,
        heure      : document.getElementById('t-heure').value || null,
        recurrence : document.getElementById('t-recur').value,
        rappel_avant: parseInt(document.getElementById('t-rappel').value) || 0
    };
    try {
        const r = await fetch('/api/taches', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const d = await r.json();
        if (d.success) { chargerModalTaches(); chargerWidgetTaches(); }
        else alert('Erreur : '+d.message);
    } catch { alert('Erreur réseau'); }
}

async function modifierTache(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/taches?userId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;
    const t = d.taches.find(t => t.id === id);
    if (!t) return;

    const dateVal  = t.date  ? t.date.split('T')[0] : '';
    const heureVal = t.heure ? t.heure.slice(0,5)   : '';
    const rappelVal = t.rappel_avant || 0;

    document.getElementById('modal-title').textContent = '✏️ Modifier la tâche';
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom:16px">
            <div class="form-row">
                <input type="text" id="t-titre-edit" value="${t.titre}" placeholder="Titre de la tâche">
            </div>
            <div class="form-row">
                <input type="date" id="t-date-edit" value="${dateVal}">
                <input type="time" id="t-heure-edit" value="${heureVal}">
                <select id="t-recur-edit">
                    <option value="none"    ${t.recurrence==='none'   ?'selected':''}>Une fois</option>
                    <option value="daily"   ${t.recurrence==='daily'  ?'selected':''}>Quotidien</option>
                    <option value="weekly"  ${t.recurrence==='weekly' ?'selected':''}>Hebdo</option>
                    <option value="monthly" ${t.recurrence==='monthly'?'selected':''}>Mensuel</option>
                </select>
            </div>
            <div class="form-row">
                <select id="t-rappel-edit" style="width:100%">
                    <option value="0"  ${rappelVal===0 ?'selected':''}>Pas de rappel anticipé</option>
                    <option value="5"  ${rappelVal===5 ?'selected':''}>5 min avant</option>
                    <option value="10" ${rappelVal===10?'selected':''}>10 min avant</option>
                    <option value="15" ${rappelVal===15?'selected':''}>15 min avant</option>
                    <option value="30" ${rappelVal===30?'selected':''}>30 min avant</option>
                    <option value="60" ${rappelVal===60?'selected':''}>1h avant</option>
                </select>
            </div>
            <div class="modal-actions" style="margin-top:12px">
                <button class="btn-save" onclick="sauvegarderModifTache(${id})">💾 Sauvegarder</button>
                <button class="btn-cancel" onclick="chargerModalTaches()">Annuler</button>
            </div>
        </div>
    `;
}

async function sauvegarderModifTache(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const titre = document.getElementById('t-titre-edit').value.trim();
    if (!titre) { alert('Entrez un titre'); return; }
    const body = {
        userId      : user.userId,
        titre,
        date        : document.getElementById('t-date-edit').value  || null,
        heure       : document.getElementById('t-heure-edit').value || null,
        recurrence  : document.getElementById('t-recur-edit').value,
        rappel_avant: parseInt(document.getElementById('t-rappel-edit').value) || 0
    };
    try {
        const r = await fetch(`/api/taches/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const d = await r.json();
        if (d.success) { chargerModalTaches(); chargerWidgetTaches(); }
        else alert('Erreur : '+d.message);
    } catch { alert('Erreur réseau'); }
}

async function cocherTache(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    try {
        await fetch(`/api/taches/${id}/cocher`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user.userId}) });
        chargerModalTaches();
        chargerWidgetTaches();
    } catch { alert('Erreur réseau'); }
}

async function supprimerTache(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    document.getElementById('modal-title').textContent = '✅ Confirmation';
    document.getElementById('modal-body').innerHTML = `
      <p style="color:#333;font-size:15px;margin-bottom:20px">Supprimer cette tâche ?</p>
      <div class="modal-actions">
        <button class="btn-delete" id="btn-tache-oui">Confirmer</button>
        <button class="btn-cancel" id="btn-tache-non">Annuler</button>
      </div>
    `;
    document.getElementById('btn-tache-oui').onclick = async () => {
        try {
            await fetch(`/api/taches/${id}?userId=${user.userId}`, { method:'DELETE' });
            chargerModalTaches();
            chargerWidgetTaches();
        } catch { alert('Erreur réseau'); }
    };
    document.getElementById('btn-tache-non').onclick = () => chargerModalTaches();
}
