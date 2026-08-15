// ===================== WIDGET & MODALE ANNIVERSAIRES =====================

async function chargerWidgetAnniversaires() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    const el = document.getElementById('wc-anniversaires');
    if (!el) return;
    try {
        const r = await fetch(`/api/anniversaires?userId=${user.userId}`);
        const d = await r.json();
        if (!d.success) return;
        const now = new Date();
        const annee = now.getFullYear();

        const avec_jours = d.anniversaires.map(a => {
            let prochaine = new Date(annee, a.mois-1, a.jour);
            if (prochaine < now && !(prochaine.getDate()===now.getDate() && prochaine.getMonth()===now.getMonth())) {
                prochaine = new Date(annee+1, a.mois-1, a.jour);
            }
            const diff = Math.ceil((prochaine - now) / 86400000);
            return { ...a, diff, prochaine };
        }).sort((a,b) => a.diff - b.diff).slice(0,5);

        if (avec_jours.length === 0) { el.textContent = 'Aucun anniversaire enregistré'; return; }

        el.innerHTML = avec_jours.map(a => {
            const label = a.diff === 0 ? `<span style="color:#e879a0;font-weight:700">Aujourd'hui 🎂</span>` :
                          a.diff === 1 ? `<span style="color:#d97706">Demain</span>` :
                          `<span style="color:#9ca3af">Dans ${a.diff}j</span>`;
            const age = a.annee ? ` — ${a.prochaine.getFullYear() - a.annee} ans` : '';
            return `• ${a.prenom}${a.nom?' '+a.nom:''} ${label}${age}`;
        }).join('<br>');
    } catch(e) { if(el) el.textContent = 'Erreur de chargement'; }
}

async function chargerModalAnniversaires() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/anniversaires?userId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;
    const now = new Date();
    const annee = now.getFullYear();

    const tries = d.anniversaires.map(a => {
        let prochaine = new Date(annee, a.mois-1, a.jour);
        if (prochaine < now && !(prochaine.getDate()===now.getDate() && prochaine.getMonth()===now.getMonth())) {
            prochaine = new Date(annee+1, a.mois-1, a.jour);
        }
        const diff = Math.ceil((prochaine - now) / 86400000);
        return {...a, diff, prochaine};
    }).sort((a,b) => a.diff - b.diff);

    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom:16px">
            <div class="form-row">
                <input type="text" id="a-prenom" placeholder="Prénom *">
                <input type="text" id="a-nom" placeholder="Nom (optionnel)">
            </div>
            <div class="form-row">
                <input type="number" id="a-jour" placeholder="Jour *" min="1" max="31">
                <input type="number" id="a-mois" placeholder="Mois *" min="1" max="12">
                <input type="number" id="a-annee" placeholder="Année (opt.)">
            </div>
            <button class="add-btn" onclick="ajouterAnniversaire()">➕ Ajouter</button>
        </div>
        ${tries.length === 0 ? '<p style="color:#9ca3af;text-align:center">Aucun anniversaire enregistré</p>' : tries.map(a => {
            const age = a.annee ? ` — ${a.prochaine.getFullYear() - a.annee} ans` : '';
            const label = a.diff===0 ? `<span class="badge-today">Aujourd'hui 🎂</span>` :
                          a.diff===1 ? `<span style="color:#d97706;font-size:12px">Demain</span>` :
                          `<span style="color:#9ca3af;font-size:12px">Dans ${a.diff}j</span>`;
            const dateStr = `${String(a.jour).padStart(2,'0')}/${String(a.mois).padStart(2,'0')}${a.annee?' '+a.annee:''}`;
            return `
                <div class="liste-item" id="anniv-${a.id}">
                    <div class="wi" style="background:#fce7f3;font-size:18px">🎂</div>
                    <div class="item-info">
                        <div class="item-titre">${a.prenom}${a.nom?' '+a.nom:''} ${label}${age}</div>
                        <div class="item-meta">${dateStr}</div>
                    </div>
                    <button class="item-del" onclick="supprimerAnniversaire(${a.id})">🗑️</button>
                </div>
            `;
        }).join('')}
    `;
}

async function ajouterAnniversaire() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const prenom = document.getElementById('a-prenom').value.trim();
    const jour   = document.getElementById('a-jour').value;
    const mois   = document.getElementById('a-mois').value;
    if (!prenom || !jour || !mois) { alert('Prénom, jour et mois sont obligatoires'); return; }
    const body = {
        userId: user.userId,
        prenom,
        nom:    document.getElementById('a-nom').value.trim()||null,
        jour:   parseInt(jour),
        mois:   parseInt(mois),
        annee:  document.getElementById('a-annee').value ? parseInt(document.getElementById('a-annee').value) : null
    };
    try {
        const r = await fetch('/api/anniversaires',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d = await r.json();
        if (d.success) { chargerModalAnniversaires(); chargerWidgetAnniversaires(); }
        else alert('Erreur : '+d.message);
    } catch { alert('Erreur réseau'); }
}

async function supprimerAnniversaire(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!confirm('Supprimer cet anniversaire ?')) return;
    try {
        await fetch(`/api/anniversaires/${id}?userId=${user.userId}`,{method:'DELETE'});
        chargerModalAnniversaires();
        chargerWidgetAnniversaires();
    } catch { alert('Erreur réseau'); }
}
