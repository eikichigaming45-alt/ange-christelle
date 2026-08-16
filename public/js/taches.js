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
        const today = new Date().toISOString().split('T')[0];
        const taches = d.taches;
        const duJour = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] === today);
        const avenir = taches.filter(t => !t.faite && t.date && t.date.split('T')[0] > today).slice(0,3);
        const flottantes = taches.filter(t => !t.faite && !t.date).slice(0,2);
        if (duJour.length === 0 && avenir.length === 0 && flottantes.length === 0) {
            el.textContent = 'Aucune tâche à venir';
            return;
        }
        let html = '';
        if (duJour.length > 0) html += `<strong style="font-size:12px;color:#059669">Aujourd'hui (${duJour.length})</strong><br>${duJour.map(t=>`• ${t.titre}`).join('<br>')}`;
        if (avenir.length > 0) html += `${duJour.length?'<br>':''}<strong style="font-size:12px;color:#6b7280">À venir</strong><br>${avenir.map(t=>`• ${t.titre} <span style="color:#9ca3af;font-size:11px">${new Date(t.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>`).join('<br>')}`;
        if (flottantes.length > 0) html += `<br><strong style="font-size:12px;color:#6b7280">Sans date</strong><br>${flottantes.map(t=>`• ${t.titre}`).join('<br>')}`;
        el.innerHTML = html;
    } catch(e) { if(el) el.textContent = 'Erreur de chargement'; }
}

async function chargerModalTaches() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/taches?userId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;
    const today = new Date().toISOString().split('T')[0];
    const taches = d.taches;
    const duJour   = taches.filter(t => t.date && t.date.split('T')[0] === today);
    const avenir   = taches.filter(t => t.date && t.date.split('T')[0] > today && !t.faite);
    const flott    = taches.filter(t => !t.date && !t.faite);
    const termines = taches.filter(t => t.faite).slice(0,5);

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
            <button class="add-btn" onclick="ajouterTache()">➕ Ajouter la tâche</button>
        </div>

        ${duJour.length > 0 ? `<div class="section-title">Aujourd'hui</div>${duJour.map(t => renderTache(t, today)).join('')}` : ''}
        ${avenir.length > 0 ? `<div class="section-title">À venir</div>${avenir.map(t => renderTache(t, today)).join('')}` : ''}
        ${flott.length  > 0 ? `<div class="section-title">Sans date</div>${flott.map(t => renderTache(t, today)).join('')}` : ''}
        ${termines.length > 0 ? `<div class="section-title">Terminées</div>${termines.map(t => renderTache(t, today)).join('')}` : ''}
        ${taches.length === 0 ? '<p style="color:#9ca3af;text-align:center;margin-top:20px">Aucune tâche pour l\'instant</p>' : ''}
    `;
}

function renderTache(t, today) {
    const dateStr = t.date ? t.date.split('T')[0] : null;
    const heureStr = t.heure ? t.heure.slice(0,5) : '';
    const isToday = dateStr === today;
    const recuLabels = {daily:'Quotidien',weekly:'Hebdo',monthly:'Mensuel'};
    return `
        <div class="liste-item ${t.faite?'faite':''}" id="tache-${t.id}">
            <div class="item-check ${t.faite?'checked':''}" onclick="cocherTache(${t.id})">
                ${t.faite?'✓':''}
            </div>
            <div class="item-info">
                <div class="item-titre">
                    ${t.titre}
                    ${isToday && !t.faite ? '<span class="badge-today">Aujourd\'hui</span>' : ''}
                    ${t.recurrence!=='none' ? `<span class="badge-recur">${recuLabels[t.recurrence]}</span>` : ''}
                </div>
                <div class="item-meta">
                    ${dateStr ? new Date(dateStr+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'}) : 'Sans date'}
                    ${heureStr ? ' à '+heureStr : ''}
                </div>
            </div>
            <button class="item-del" onclick="supprimerTache(${t.id})">🗑️</button>
        </div>
    `;
}

async function ajouterTache() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const titre = document.getElementById('t-titre').value.trim();
    if (!titre) { alert('Entrez un titre'); return; }
    const body = {
        userId: user.userId,
        titre,
        date: document.getElementById('t-date').value || null,
        heure: document.getElementById('t-heure').value || null,
        recurrence: document.getElementById('t-recur').value
    };
    try {
        const r = await fetch('/api/taches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d = await r.json();
        if (d.success) { chargerModalTaches(); chargerWidgetTaches(); }
        else alert('Erreur : '+d.message);
    } catch { alert('Erreur réseau'); }
}

async function cocherTache(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    try {
        await fetch(`/api/taches/${id}/cocher`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.userId})});
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
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-tache-oui').onclick = async () => {
        try {
            await fetch(`/api/taches/${id}?userId=${user.userId}`,{method:'DELETE'});
            chargerModalTaches();
            chargerWidgetTaches();
        } catch { alert('Erreur réseau'); }
    };
    document.getElementById('btn-tache-non').onclick = () => chargerModalTaches();
}

