// ============================================================
// public/js/social.js
// ============================================================

// ── Utilitaire auth ───────────────────────────────────────────
function _socialAuth() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    return { user, token: user?.token };
}

// ── Labels triés alphabétiquement ────────────────────────────
const _SHARE_LABELS_LIST = [
    { type: 'cycle',    label: 'Cycle menstruel' },
    { type: 'planning', label: 'Planning'         },
    { type: 'rdv',      label: 'Rendez-vous'      },
    { type: 'taches',   label: 'Tâches'           },
];

const _SHARE_LABELS = Object.fromEntries(
    _SHARE_LABELS_LIST.map(l => [l.type, l.label])
);

// ── Ordre d'affichage widget social : cycle en premier, reste alphabétique
const _SHARE_ORDER = ['cycle', 'planning', 'rdv', 'taches'];

// ── Lire le sexe de l'utilisateur courant via l'API ──────────
async function _getSexeCourant() {
    try {
        const { token } = _socialAuth();
        const r = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        return d?.profil?.sexe ?? null;
    } catch {
        return null;
    }
}

// ── Modale conseil complet ────────────────────────────────────
function _ouvrirModaleConseil(texte) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px`;
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;
                    max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.18)">
            <div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:12px">
                Conseil du jour
            </div>
            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
                ${texte}
            </p>
            <button style="width:100%;padding:11px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                           color:#fff;border:none;border-radius:10px;font-size:14px;
                           font-weight:600;cursor:pointer">
                Fermer
            </button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ============================================================
// WIDGET SOCIAL (contenu reçu — affiché dans l'onglet Quotidien)
// ============================================================

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

        const sections = await Promise.all(
            Object.values(parOwner).map(owner => _renderOwnerSection(owner, token))
        );
        el.innerHTML = sections.join('');

    } catch {
        el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Section par owner — cycle en premier, reste trié alphabétiquement ─
async function _renderOwnerSection(owner, token) {
    const nom    = [owner.prenom, owner.nom].filter(Boolean).join(' ') || owner.username;
    const avatar = owner.photo
        ? `<img src="${owner.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                       color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
                       justify-content:center;flex-shrink:0">
               ${(owner.prenom?.[0] || owner.username[0]).toUpperCase()}
           </div>`;

    // Cycle en premier, puis le reste trié selon _SHARE_ORDER (alphabétique)
    const typesTries = _SHARE_ORDER.filter(t => owner.types.includes(t));

    const blocs = await Promise.all(
        typesTries.map(type => _renderCategorieBloc(owner.owner_id, type, token))
    );

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
    } catch { return ''; }
}

// ── Bloc cycle ────────────────────────────────────────────────
async function _renderBlocCycle(ownerId, token) {
    const r = await fetch(`/api/social/conseil/${ownerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await r.json();
    if (!d.success) return '';

    const ci = d.cycleInfo;

    let carteInfos = '';
    if (ci) {
        const lignes = [];

        if (ci.enRegles && ci.finRegles) {
            lignes.push(`
                <div style="display:flex;justify-content:space-between;align-items:flex-start;
                            padding:5px 0;border-bottom:1px solid #f3f4f6">
                    <span style="font-size:12px;color:#6b7280;flex:1">Fin des règles estimée</span>
                    <span style="font-size:12px;font-weight:600;color:#ef4444;text-align:right">${ci.finRegles}</span>
                </div>`);
        }

        lignes.push(`
            <div style="display:flex;justify-content:space-between;align-items:flex-start;
                        padding:5px 0;border-bottom:1px solid #f3f4f6">
                <span style="font-size:12px;color:#6b7280;flex:1">${ci.labelOvulation}</span>
                <span style="font-size:12px;font-weight:600;color:#7c3aed;text-align:right">${ci.valeurOvulation}</span>
            </div>`);

        lignes.push(`
            <div style="display:flex;justify-content:space-between;align-items:flex-start;
                        padding:5px 0;border-bottom:1px solid #f3f4f6">
                <span style="font-size:12px;color:#6b7280;flex:1;padding-right:8px">${ci.labelFenetre}</span>
                <span style="font-size:12px;font-weight:600;color:#7c3aed;text-align:right;white-space:nowrap">${ci.valeurFenetre}</span>
            </div>`);

        lignes.push(`
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0">
                <span style="font-size:12px;color:#6b7280;flex:1">Prochaines règles</span>
                <span style="font-size:12px;font-weight:600;color:#6b7280;text-align:right">
                    ${ci.prochainDebut}
                    ${ci.joursAvantRegles > 0
                        ? `<span style="font-size:11px;color:#9ca3af;margin-left:4px">(dans ${ci.joursAvantRegles}j)</span>`
                        : ''}
                </span>
            </div>`);

        carteInfos = `
            <div style="background:#fff;border-radius:10px;padding:10px 12px;
                        border:1px solid #ede9fe;margin-bottom:8px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:12px;font-weight:700;color:#7c3aed">${ci.phaseLabel}</span>
                    <span style="font-size:11px;color:#9ca3af">Jour ${ci.jourCycle} / ${ci.dureeCycle}</span>
                </div>
                ${lignes.join('')}
                ${ci.enFenetre
                    ? `<div style="margin-top:8px;padding:6px 10px;background:#fdf4ff;border-radius:8px;
                                   font-size:12px;color:#7c3aed;font-weight:600;text-align:center">
                           🌸 Fenêtre fertile en cours
                       </div>`
                    : ''}
                ${ci.estOvulation
                    ? `<div style="margin-top:8px;padding:6px 10px;background:#fdf4ff;border-radius:8px;
                                   font-size:12px;color:#7c3aed;font-weight:600;text-align:center">
                           🌟 Jour d'ovulation
                       </div>`
                    : ''}
            </div>`;
    }

    const titre = `
        <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:6px">Suivi du cycle</div>`;

    if (!d.moodRempli) {
        return `
            <div style="margin-bottom:10px">
                ${titre}
                ${carteInfos}
                <div style="background:#fff;border-radius:10px;padding:10px 12px;
                            border:1px solid #ede9fe;font-size:13px;color:#6b7280;margin-bottom:8px">
                    Elle n'a pas encore renseigné son humeur aujourd'hui.
                </div>
                <button data-owner-id="${ownerId}"
                    data-action="envoyer-coucou"
                    style="width:100%;padding:10px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                           color:#fff;border:none;border-radius:10px;font-size:13px;
                           font-weight:600;cursor:pointer">
                    Envoyer un coucou 💕
                </button>
            </div>`;
    }

    const moodBadges = (d.moods || []).map(m =>
        `<span style="background:#ede9fe;color:#7c3aed;border-radius:20px;
                      padding:3px 8px;font-size:11px;font-weight:600">${m}</span>`
    ).join('');

    let conseilBloc = '';
    if (d.conseil) {
        const texteComplet = d.conseil;
        const court        = texteComplet.length > 120
            ? texteComplet.slice(0, 120).trimEnd() + '…'
            : texteComplet;
        const avecLien     = texteComplet.length > 120
            ? `${court} <span data-conseil-complet="${encodeURIComponent(texteComplet)}"
                              data-action="lire-conseil"
                              style="color:#7c3aed;font-weight:600;cursor:pointer;white-space:nowrap">
                   Lire la suite
               </span>`
            : court;

        conseilBloc = `
            <div style="margin-top:8px;padding:10px 12px;background:#fdf4ff;border-radius:10px;
                        border-left:3px solid #7c3aed;font-size:13px;color:#374151;line-height:1.6">
                ${avecLien}
            </div>`;
    }

    return `
        <div style="margin-bottom:10px">
            ${titre}
            ${carteInfos}
            <div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #ede9fe">
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                    ${moodBadges}
                </div>
                ${conseilBloc}
            </div>
        </div>`;
}

// ── Délégation "Lire la suite" ────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="lire-conseil"]');
    if (!btn) return;
    _ouvrirModaleConseil(decodeURIComponent(btn.dataset.conseilComplet));
});

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
                ${rdv.praticien
                    ? `<div style="color:#9ca3af;font-size:11px">Dr. ${rdv.praticien}</div>`
                    : ''}
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
            ${t.heure
                ? `<span style="color:#9ca3af;font-size:11px;margin-left:auto">${t.heure.slice(0,5)}</span>`
                : ''}
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

// ── Envoyer un coucou (délégation) ───────────────────────────
// Le bouton repasse à son état initial après 3s
document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="envoyer-coucou"]');
    if (!btn) return;
    const ownerId = btn.dataset.ownerId;
    const { token } = _socialAuth();
    btn.disabled    = true;
    btn.textContent = 'Envoi...';
    try {
        const r = await fetch(`/api/social/coucou/${ownerId}`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
            btn.textContent      = 'Coucou envoyé 💕';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.disabled         = false;
                btn.textContent      = 'Envoyer un coucou 💕';
                btn.style.background = 'linear-gradient(135deg,#7c3aed,#6d28d9)';
            }, 3000);
        } else {
            btn.disabled    = false;
            btn.textContent = 'Envoyer un coucou 💕';
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = 'Envoyer un coucou 💕';
    }
});

// ============================================================
// GESTION DES PARTAGES — onglet Social du profil
// ============================================================

async function _socialOnglet(tab) {
    ['miens', 'nouveau'].forEach(t => {
        const btn = document.getElementById(`social-tab-${t}`);
        if (!btn) return;
        btn.style.background = t === tab ? '#7c3aed' : '#f5f3ff';
        btn.style.color      = t === tab ? '#fff'    : '#7c3aed';
    });
    if (tab === 'miens')   await _renderOngletMiens();
    if (tab === 'nouveau') await _renderOngletNouveau();
}

// ============================================================
// ONGLET — CE QUE JE PARTAGE
// ============================================================

async function _renderOngletMiens() {
    const { token } = _socialAuth();
    const container = document.getElementById('social-tab-content');
    if (!container) return;
    container.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center">Chargement…</p>';

    try {
        const [resMiens, sexe] = await Promise.all([
            fetch('/api/social/partages/miens', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()),
            _getSexeCourant()
        ]);

        if (!resMiens.success) throw new Error();

        const partages = resMiens.partages || [];

        if (partages.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:24px 8px;color:#9ca3af">
                    <div style="font-size:32px;margin-bottom:8px">🔒</div>
                    <div style="font-size:13px;line-height:1.6">
                        Tu ne partages encore rien avec personne.<br>
                        Utilise l'onglet <strong style="color:#7c3aed">Partager avec…</strong> pour commencer.
                    </div>
                </div>`;
            return;
        }

        const parViewer = {};
        partages.forEach(p => {
            if (!parViewer[p.viewer_id]) {
                parViewer[p.viewer_id] = {
                    viewer_id: p.viewer_id,
                    username : p.username,
                    prenom   : p.prenom,
                    nom      : p.nom,
                    photo    : p.photo,
                    partages : []
                };
            }
            parViewer[p.viewer_id].partages.push(p);
        });

        const typesDisponibles = sexe === 'homme'
            ? _SHARE_LABELS_LIST.filter(l => l.type !== 'cycle')
            : _SHARE_LABELS_LIST;

        const blocs = Object.values(parViewer)
            .map(v => _htmlBlocViewer(v, typesDisponibles))
            .join('');
        container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${blocs}</div>`;

    } catch {
        container.innerHTML = '<p style="color:#ef4444;font-size:13px;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Bloc viewer — affiche tous les types, toggle aligné ───────
function _htmlBlocViewer(v, typesDisponibles) {
    const nom    = [v.prenom, v.nom].filter(Boolean).join(' ') || v.username;
    const avatar = v.photo
        ? `<img src="${v.photo}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                       color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;
                       justify-content:center;flex-shrink:0">
               ${(v.prenom?.[0] || v.username[0]).toUpperCase()}
           </div>`;

    const lignes = typesDisponibles.map(l => {
        const partage = v.partages.find(p => p.resource_type === l.type);
        const existe  = !!partage;
        const actif   = partage?.active ?? false;
        const shareId = partage?.id ?? '';

        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:8px 10px;background:#fff;border-radius:8px;
                    border:1px solid #f3f4f6;margin-bottom:4px;min-height:40px">
            <span style="font-size:13px;color:#374151;flex:1">${_SHARE_LABELS[l.type]}</span>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <label style="position:relative;display:inline-flex;align-items:center;
                              width:38px;height:22px;flex-shrink:0;cursor:pointer">
                    <input type="checkbox" ${actif ? 'checked' : ''}
                        data-share-id="${shareId}"
                        data-viewer-id="${v.viewer_id}"
                        data-resource-type="${l.type}"
                        data-existe="${existe}"
                        data-action="toggle-partage"
                        style="opacity:0;width:0;height:0;position:absolute">
                    <span style="position:absolute;inset:0;border-radius:22px;cursor:pointer;
                                 background:${actif ? '#7c3aed' : '#d1d5db'};transition:background .2s">
                        <span style="position:absolute;top:3px;left:${actif ? '19px' : '3px'};
                                     width:16px;height:16px;border-radius:50%;background:#fff;
                                     transition:left .2s;display:block"></span>
                    </span>
                </label>
                                <div style="width:65px;display:flex;justify-content:flex-end">
                    ${existe
                        ? `<button data-action="supprimer-partage"
                                   data-del-id="${shareId}"
                                   style="background:#fee2e2;color:#ef4444;border:none;border-radius:6px;
                                          padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer">
                               Supprimer
                           </button>`
                        : ''
                    }
                </div>
            </div>
        </div>`;
    }).join('');

    return `
        <div style="background:#faf5ff;border-radius:12px;padding:12px 14px;border:1px solid #ede9fe">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                ${avatar}
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nom}</div>
            </div>
            ${lignes}
        </div>`;
}

// ── Délégation toggle — création si partage inexistant ────────
document.addEventListener('change', async e => {
    const cb = e.target.closest('[data-action="toggle-partage"]');
    if (!cb) return;
    const id           = cb.dataset.shareId;
    const active       = cb.checked;
    const existe       = cb.dataset.existe === 'true';
    const viewerId     = cb.dataset.viewerId;
    const resourceType = cb.dataset.resourceType;
    const { token }    = _socialAuth();
    const track        = cb.nextElementSibling;
    const thumb        = track?.querySelector('span');
    if (track) track.style.background = active ? '#7c3aed' : '#d1d5db';
    if (thumb) thumb.style.left       = active ? '19px'   : '3px';

    try {
        if (!existe) {
            await fetch('/api/social/partages', {
                method : 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body   : JSON.stringify({ viewer_id: parseInt(viewerId), resource_type: resourceType })
            });
            await _renderOngletMiens();
        } else {
            await fetch(`/api/social/partages/${id}`, {
                method : 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body   : JSON.stringify({ active })
            });
        }
    } catch {
        cb.checked = !active;
        if (track) track.style.background = !active ? '#7c3aed' : '#d1d5db';
        if (thumb) thumb.style.left       = !active ? '19px'    : '3px';
    }
});

// ── Délégation suppression ────────────────────────────────────
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="supprimer-partage"]');
    if (!btn) return;
    _supprimerPartage(btn.dataset.delId);
});

// ── Confirmation suppression ──────────────────────────────────
function _supprimerPartage(id) {
    const overlay = document.createElement('div');
    overlay.id    = 'social-confirm-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px`;
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;
                    max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.18)">
            <div style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:8px">
                Supprimer ce partage ?
            </div>
            <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:20px">
                La personne ne pourra plus voir ce contenu.
            </p>
            <div style="display:flex;gap:10px">
                <button data-action="confirmer-supprimer" data-id="${id}"
                    style="flex:1;padding:11px;background:#ef4444;color:#fff;border:none;
                           border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
                    Supprimer
                </button>
                <button data-action="annuler-supprimer"
                    style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;
                           border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
                    Annuler
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('[data-action="confirmer-supprimer"]').addEventListener('click', async () => {
        const { token } = _socialAuth();
        overlay.remove();
        try {
            await fetch(`/api/social/partages/${id}`, {
                method : 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch { /* silencieux */ }
        await _renderOngletMiens();
    });

    overlay.querySelector('[data-action="annuler-supprimer"]').addEventListener('click', () => {
        overlay.remove();
    });
}

// ============================================================
// ONGLET — PARTAGER AVEC QUELQU'UN
// ============================================================

async function _renderOngletNouveau() {
    const container = document.getElementById('social-tab-content');
    if (!container) return;
    container.innerHTML = `
        <div style="margin-bottom:14px">
            <input id="social-search-input"
                type="text"
                placeholder="Rechercher par nom d'utilisateur…"
                style="width:100%;box-sizing:border-box;padding:10px 12px;
                       border:1px solid #ede9fe;border-radius:10px;font-size:14px;
                       outline:none;background:#faf5ff;color:#1f2937">
            <div id="social-search-results" style="margin-top:8px"></div>
        </div>
        <div id="social-nouveau-form" style="display:none">
            <div style="background:#faf5ff;border-radius:12px;padding:14px;border:1px solid #ede9fe">
                <div id="social-user-selectionne" style="margin-bottom:14px"></div>
                <div style="font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
                    Que souhaites-tu partager ?
                </div>
                <div id="social-types-list" style="display:flex;flex-direction:column;gap:8px"></div>
                <div id="social-share-msg"
                    style="font-size:12px;min-height:16px;margin-top:10px;text-align:center"></div>
                <button data-action="envoyer-partages"
                    style="width:100%;margin-top:14px;padding:12px;
                           background:linear-gradient(135deg,#7c3aed,#6d28d9);
                           color:#fff;border:none;border-radius:10px;
                           font-size:14px;font-weight:600;cursor:pointer">
                    Partager
                </button>
            </div>
        </div>`;

    let _timer = null;
    document.getElementById('social-search-input').addEventListener('input', e => {
        clearTimeout(_timer);
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('social-search-results').innerHTML = '';
            return;
        }
        _timer = setTimeout(() => _socialRechercherUser(q), 350);
    });

    document.querySelector('[data-action="envoyer-partages"]')
        .addEventListener('click', _envoyerPartages);
}

// ── Recherche utilisateur ─────────────────────────────────────
async function _socialRechercherUser(q) {
    const results = document.getElementById('social-search-results');
    if (!results) return;
    const { token } = _socialAuth();
    try {
        const r = await fetch(`/api/social/users/search?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.success) return;

        if (!d.users.length) {
            results.innerHTML = '<div style="font-size:13px;color:#9ca3af;padding:8px 4px">Aucun utilisateur trouvé.</div>';
            return;
        }

        results.innerHTML = d.users.map(u => {
            const nom    = [u.prenom, u.nom].filter(Boolean).join(' ') || u.username;
            const avatar = u.photo
                ? `<img src="${u.photo}" style="width:30px;height:30px;border-radius:50%;object-fit:cover" alt="">`
                : `<div style="width:30px;height:30px;border-radius:50%;background:#7c3aed;
                               color:#fff;font-size:12px;font-weight:700;display:flex;
                               align-items:center;justify-content:center">
                       ${(u.prenom?.[0] || u.username[0]).toUpperCase()}
                   </div>`;
            return `
                <div data-action="select-user"
                     data-user-id="${u.id}"
                     data-username="${u.username}"
                     data-prenom="${u.prenom || ''}"
                     data-nom="${u.nom || ''}"
                     data-photo="${u.photo || ''}"
                     style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                            background:#fff;border-radius:10px;border:1px solid #ede9fe;
                            margin-bottom:6px;cursor:pointer">
                    ${avatar}
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#1f2937">${nom}</div>
                        <div style="font-size:11px;color:#9ca3af">@${u.username}</div>
                    </div>
                </div>`;
        }).join('');

        results.querySelectorAll('[data-action="select-user"]').forEach(el => {
            el.addEventListener('click', () => _socialSelectionnerUser(el));
        });

    } catch { /* silencieux */ }
}

// ── Sélectionner un utilisateur ───────────────────────────────
async function _socialSelectionnerUser(el) {
    const userId   = el.dataset.userId;
    const username = el.dataset.username;
    const prenom   = el.dataset.prenom;
    const nom      = el.dataset.nom;
    const photo    = el.dataset.photo;
    const { token } = _socialAuth();

    document.getElementById('social-search-input').value       = '';
    document.getElementById('social-search-results').innerHTML = '';

    const form = document.getElementById('social-nouveau-form');
    form.style.display    = 'block';
    form.dataset.viewerId = userId;

    const nomAffiche = [prenom, nom].filter(Boolean).join(' ') || username;
    const avatar     = photo
        ? `<img src="${photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
        : `<div style="width:36px;height:36px;border-radius:50%;background:#7c3aed;
                       color:#fff;font-size:14px;font-weight:700;display:flex;
                       align-items:center;justify-content:center;flex-shrink:0">
               ${(prenom?.[0] || username[0]).toUpperCase()}
           </div>`;

    document.getElementById('social-user-selectionne').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;background:#fff;
                    border-radius:10px;padding:10px 12px;border:1px solid #ede9fe">
            ${avatar}
            <div>
                <div style="font-size:14px;font-weight:700;color:#1f2937">${nomAffiche}</div>
                <div style="font-size:12px;color:#9ca3af">@${username}</div>
            </div>
            <button data-action="annuler-selection"
                style="margin-left:auto;background:none;border:none;
                       color:#9ca3af;font-size:18px;cursor:pointer;line-height:1">×</button>
        </div>`;

    document.querySelector('[data-action="annuler-selection"]')
        .addEventListener('click', _socialAnnulerSelection);

    document.getElementById('social-share-msg').textContent = '';

    let dejaPartages = [];
    try {
        const r = await fetch('/api/social/partages/miens', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
            dejaPartages = d.partages
                .filter(p => String(p.viewer_id) === String(userId) && p.active)
                .map(p => p.resource_type);
        }
    } catch { /* silencieux */ }

    const sexe = await _getSexeCourant();
    const typesDisponibles = sexe === 'homme'
        ? _SHARE_LABELS_LIST.filter(l => l.type !== 'cycle')
        : _SHARE_LABELS_LIST;

    document.getElementById('social-types-list').innerHTML = typesDisponibles.map(l => `
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                      background:#fff;border-radius:8px;padding:10px 12px;
                      border:1px solid ${dejaPartages.includes(l.type) ? '#a78bfa' : '#f3f4f6'}">
            <input type="checkbox"
                   value="${l.type}"
                   id="share-type-${l.type}"
                   ${dejaPartages.includes(l.type) ? 'checked' : ''}
                   style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;flex-shrink:0;margin:0">
            <span style="font-size:13px;color:#374151;flex:1">${l.label}</span>
            ${dejaPartages.includes(l.type)
                ? '<span style="font-size:11px;color:#7c3aed;font-weight:600">Déjà partagé</span>'
                : ''}
        </label>`).join('');
}

// ── Annuler la sélection ──────────────────────────────────────
function _socialAnnulerSelection() {
    const form = document.getElementById('social-nouveau-form');
    if (form) { form.style.display = 'none'; form.dataset.viewerId = ''; }
    const sel = document.getElementById('social-user-selectionne');
    if (sel) sel.innerHTML = '';
    const liste = document.getElementById('social-types-list');
    if (liste) liste.innerHTML = '';
    const msg = document.getElementById('social-share-msg');
    if (msg) msg.textContent = '';
}

// ── Envoyer les partages cochés ───────────────────────────────
async function _envoyerPartages() {
    const { token } = _socialAuth();
    const form     = document.getElementById('social-nouveau-form');
    const viewerId = form?.dataset.viewerId;
    const msg      = document.getElementById('social-share-msg');
    if (!viewerId) return;

    const types = _SHARE_LABELS_LIST
        .map(l => l.type)
        .filter(t => document.getElementById(`share-type-${t}`)?.checked);

    if (types.length === 0) {
        msg.textContent = 'Sélectionne au moins un type de contenu.';
        msg.style.color = '#ef4444';
        return;
    }

    msg.textContent = 'Envoi en cours…';
    msg.style.color = '#9ca3af';

    const resultats = await Promise.all(types.map(async type => {
        try {
            const r = await fetch('/api/social/partages', {
                method : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type' : 'application/json'
                },
                body: JSON.stringify({ viewer_id: parseInt(viewerId), resource_type: type })
            });
            const d = await r.json();
            return { type, success: d.success, message: d.message };
        } catch {
            return { type, success: false, message: 'Erreur réseau.' };
        }
    }));

    const echecs = resultats.filter(r => !r.success);
    if (echecs.length === 0) {
        msg.textContent = '✅ Partages mis à jour !';
        msg.style.color = '#10b981';
        setTimeout(async () => {
            await _renderOngletNouveau();
            chargerWidgetSocial();
        }, 1200);
    } else {
        msg.textContent = echecs.map(e => `${_SHARE_LABELS[e.type]} : ${e.message}`).join(' · ');
        msg.style.color = '#ef4444';
    }
}
