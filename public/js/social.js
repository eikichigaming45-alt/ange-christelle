// ============================================================
// public/js/social.js
// Widget Social — onglet Quotidien.
// Affiche ce que les autres ont partagé avec moi.
// Sections dynamiques par owner et par catégorie.
// ============================================================

// ── Utilitaire auth ───────────────────────────────────────────
function _socialAuth() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return { user, token: user?.token };
}

// ── Formatage date courte ─────────────────────────────────────
function _socialFormatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
        weekday: 'short', day: '2-digit', month: 'short'
    });
}

// ── Chargement principal du widget ────────────────────────────
async function chargerWidgetSocial() {
    const el = document.getElementById('wc-social');
    if (!el) return;
    const { token } = _socialAuth();
    if (!token) return;

    try {
        const r = await fetch('/api/social/partages/recus', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();

        const partages = d.partages || [];

        if (partages.length === 0) {
            el.innerHTML = `
                <div style="text-align:center;padding:16px 8px;color:#9ca3af">
                    <div style="font-size:28px;margin-bottom:8px">🤍</div>
                    <div style="font-size:13px;line-height:1.5">
                        Rien n'a encore été partagé avec toi.<br>
                        Quand quelqu'un partage quelque chose, tu le verras ici.
                    </div>
                </div>`;
            return;
        }

        // Grouper par owner
        const parOwner = {};
        partages.forEach(p => {
            if (!parOwner[p.owner_id]) {
                parOwner[p.owner_id] = {
                    owner_id : p.owner_id,
                    prenom   : p.prenom,
                    nom      : p.nom,
                    photo    : p.photo,
                    username : p.username,
                    types    : []
                };
            }
            parOwner[p.owner_id].types.push(p.resource_type);
        });

        // Construire les sections en parallèle
        const sections = await Promise.all(
            Object.values(parOwner).map(owner => _renderOwnerSection(owner, token))
        );

        el.innerHTML = sections.join('');

    } catch {
        el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Section par owner ─────────────────────────────────────────
async function _renderOwnerSection(owner, token) {
    const nom    = [owner.prenom, owner.nom].filter(Boolean).join(' ') || owner.username;
    const avatar = owner.photo
        ? `<img src="${owner.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                       color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
                       justify-content:center;flex-shrink:0">
               ${(owner.prenom?.[0] || owner.username[0]).toUpperCase()}
           </div>`;

    // Charger chaque catégorie partagée
    const blocs = await Promise.all(owner.types.map(type =>
        _renderCategorieBloc(owner.owner_id, type, token)
    ));

    return `
        <div style="margin-bottom:16px;background:#faf5ff;border-radius:14px;
                    padding:12px 14px;border:1px solid #ede9fe">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                ${avatar}
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nom}</div>
            </div>
            ${blocs.join('')}
        </div>`;
}

// ── Bloc par catégorie ────────────────────────────────────────
async function _renderCategorieBloc(ownerId, type, token) {
    try {
        switch (type) {
            case 'cycle'   : return await _renderBlocCycle(ownerId, token);
            case 'rdv'     : return await _renderBlocRdv(ownerId, token);
            case 'taches'  : return await _renderBlocTaches(ownerId, token);
            case 'planning': return await _renderBlocPlanning(ownerId, token);
            default        : return '';
        }
    } catch {
        return '';
    }
}

// ── Bloc cycle ────────────────────────────────────────────────
async function _renderBlocCycle(ownerId, token) {
    const r = await fetch(`/api/social/conseil/${ownerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success) return '';

    if (!d.moodRempli) {
        // Mood non rempli → bouton Coucou
        return `
            <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:6px">Suivi du cycle</div>
                <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #ede9fe;
                            font-size:13px;color:#6b7280;margin-bottom:8px">
                    Elle n'a pas encore renseigné son humeur aujourd'hui.
                </div>
                <button data-owner-id="${ownerId}"
                    onclick="_envoyerCoucou(${ownerId})"
                    style="width:100%;padding:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                           color:#fff;border:none;border-radius:10px;font-size:13px;
                           font-weight:600;cursor:pointer">
                    Envoyer un coucou 💕
                </button>
            </div>`;
    }

    // Mood rempli → conseil Groq
    return `
        <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:6px">Suivi du cycle</div>
            <div style="background:#fff;border-radius:10px;padding:12px;
                        border-left:3px solid #7c3aed;border:1px solid #ede9fe">
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
                    ${(d.moods || []).map(m =>
                        `<span style="background:#ede9fe;color:#7c3aed;border-radius:20px;
                                      padding:3px 8px;font-size:11px;font-weight:600">${m}</span>`
                    ).join('')}
                </div>
                <div style="font-size:13px;color:#374151;line-height:1.6">${d.conseil || ''}</div>
            </div>
        </div>`;
}

// ── Bloc RDV ──────────────────────────────────────────────────
async function _renderBlocRdv(ownerId, token) {
    const r = await fetch(`/api/social/data/${ownerId}/rdv`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success || !d.data.length) {
        return `
            <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:6px">Rendez-vous</div>
                <div style="font-size:13px;color:#9ca3af">Aucun rendez-vous à venir.</div>
            </div>`;
    }
    const items = d.data.slice(0, 3).map(rdv => {
        const date = new Date(rdv.date_rdv).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        return `
            <div style="padding:8px 10px;background:#fff;border-radius:8px;
                        margin-bottom:4px;border:1px solid #f3f4f6;font-size:13px">
                <div style="font-weight:600;color:#1f2937">${rdv.titre}</div>
                <div style="color:#6b7280;font-size:12px">📅 ${date}</div>
                ${rdv.praticien ? `<div style="color:#9ca3af;font-size:11px">Dr. ${rdv.praticien}</div>` : ''}
            </div>`;
    }).join('');
    return `
        <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:6px">Rendez-vous</div>
            ${items}
        </div>`;
}

// ── Bloc Tâches ───────────────────────────────────────────────
async function _renderBlocTaches(ownerId, token) {
    const r = await fetch(`/api/social/data/${ownerId}/taches`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success || !d.data.length) {
        return `
            <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:6px">Tâches du jour</div>
                <div style="font-size:13px;color:#9ca3af">Aucune tâche aujourd'hui.</div>
            </div>`;
    }
    const items = d.data.map(t => `
        <div style="padding:8px 10px;background:#fff;border-radius:8px;
                    margin-bottom:4px;border:1px solid #f3f4f6;
                    display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="color:${t.faite ? '#10b981' : '#9ca3af'};font-size:16px">
                ${t.faite ? '✅' : '⬜'}
            </span>
            <span style="color:#1f2937;${t.faite ? 'text-decoration:line-through;color:#9ca3af' : ''}">
                ${t.titre}
            </span>
            ${t.heure ? `<span style="color:#9ca3af;font-size:11px;margin-left:auto">${t.heure.slice(0,5)}</span>` : ''}
        </div>`).join('');
    return `
        <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:6px">Tâches du jour</div>
            ${items}
        </div>`;
}

// ── Bloc Planning ─────────────────────────────────────────────
async function _renderBlocPlanning(ownerId, token) {
    const r = await fetch(`/api/social/data/${ownerId}/planning`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success || !d.data.length) {
        return `
            <div style="margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:6px">Planning</div>
                <div style="font-size:13px;color:#9ca3af">Rien au planning aujourd'hui.</div>
            </div>`;
    }
    const SHIFT_COLORS = {
        'Travail'   : '#f4a261',
        'Repos'     : '#90caf9',
        'Congé payé': '#80cbc4',
        'Mission'   : '#ce93d8',
        'Autre'     : '#bcaaa4'
    };
    const items = d.data.map(p => {
        const couleur = SHIFT_COLORS[p.categorie] || '#bcaaa4';
        const label   = p.categorie === 'Autre' && p.libelle_personnalise
            ? p.libelle_personnalise : p.categorie;
        return `
            <div style="padding:8px 10px;background:${couleur}22;border-left:3px solid ${couleur};
                        border-radius:8px;margin-bottom:4px;font-size:13px">
                <div style="font-weight:600;color:#1f2937">${label}</div>
                ${p.heure_debut
                    ? `<div style="color:#6b7280;font-size:12px">
                           ${p.heure_debut.slice(0,5)} → ${(p.heure_fin||'').slice(0,5)||'?'}
                       </div>`
                    : ''}
            </div>`;
    }).join('');
    return `
        <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                        letter-spacing:.5px;margin-bottom:6px">Planning</div>
            ${items}
        </div>`;
}

// ── Envoyer un coucou ─────────────────────────────────────────
async function _envoyerCoucou(ownerId) {
    const { token } = _socialAuth();
    const btn = document.querySelector(`button[data-owner-id="${ownerId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }
    try {
        const r = await fetch(`/api/social/coucou/${ownerId}`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success && btn) {
            btn.textContent      = 'Coucou envoyé 💕';
            btn.style.background = '#10b981';
        } else if (btn) {
            btn.disabled    = false;
            btn.textContent = 'Envoyer un coucou 💕';
        }
    } catch {
        if (btn) {
            btn.disabled    = false;
            btn.textContent = 'Envoyer un coucou 💕';
        }
    }
}
