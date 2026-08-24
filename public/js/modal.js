// ============================================================
// public/js/modal.js
// ============================================================

const JOURS_MODAL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ===================== OUVERTURE MODALE ======================

async function openModal(type) {
    document.getElementById('overlay').classList.add('on');
    const titres = {
        meteo        : 'Météo du jour',
        priere       : 'Prière du jour',
        islam        : 'Prières & Hadiths',
        taches       : 'Tâches du jour',
        planning     : 'Mon Planning',
        anniversaires: 'Anniversaires',
        profil       : 'Mon Profil',
        admin        : 'Administration',
        cycle        : 'Suivi du cycle',
        rendezvous   : 'Rendez-vous médicaux',
        astrologie   : 'Astrologie'
    };
    document.getElementById('modal-title').textContent = titres[type] || type;

    // ── Météo ─────────────────────────────────────────────────
    if (type === 'meteo') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        _ouvrirModaleMeteo();

    // ── Prière ────────────────────────────────────────────────
    } else if (type === 'priere') {
        document.getElementById('modal-body').innerHTML = priere ? `
            <div class="islam-modal">
                <div style="display:flex;justify-content:space-between;align-items:center;
                            background:linear-gradient(135deg,#fef3c7,#fde68a);
                            border-radius:12px;padding:12px 16px;margin-bottom:16px;
                            border-left:4px solid #d97706;">
                    ${priere.titre
                        ? `<div style="font-size:13px;font-weight:700;color:#78350f;line-height:1.4">📖 ${priere.titre}</div>`
                        : '<div></div>'}
                    <button onclick="lirePriereModal(event)" id="btn-speaker-modal"
                        style="background:#fff8e1;border:none;border-radius:50%;
                               width:36px;height:36px;cursor:pointer;font-size:18px;
                               display:flex;align-items:center;justify-content:center;
                               box-shadow:0 2px 4px rgba(0,0,0,0.1);flex-shrink:0;margin-left:10px">
                        🔊
                    </button>
                </div>

                ${priere.evangile ? `
                <div style="margin-bottom:14px">
                    <div class="islam-modal-titre-section">Évangile du jour</div>
                    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #d97706;
                                font-size:13px;color:#444;line-height:1.8;
                                max-height:260px;overflow-y:auto">
                        ${priere.evangile.replace(/\n/g, '<br>')}
                    </div>
                </div>` : `
                <div style="margin-bottom:14px">
                    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #d97706;
                                font-size:13px;color:#444;line-height:1.8;font-style:italic">
                        "${priere.texte}"<br><br><em>— ${priere.ref}</em>
                    </div>
                </div>`}

                ${priere.lecture1 ? `
                <div style="margin-bottom:14px">
                    <div class="islam-modal-titre-section">Première lecture</div>
                    <div style="background:#f0f9ff;border-radius:10px;padding:14px 16px;
                                border-left:4px solid #0369a1;
                                font-size:13px;color:#444;line-height:1.8;
                                max-height:200px;overflow-y:auto">
                        ${priere.lecture1.replace(/\n/g, '<br>')}
                    </div>
                </div>` : ''}
            </div>
        ` : '<p style="color:#9ca3af;text-align:center;padding:20px">Chargement...</p>';

    // ── Islam ─────────────────────────────────────────────────
    } else if (type === 'islam') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
        if (!window._islamData) {
            if (typeof window.chargerIslam === 'function') window.chargerIslam();
            await new Promise(resolve => {
                let tries = 0;
                const iv = setInterval(() => {
                    tries++;
                    if (window._islamData || tries >= 15) { clearInterval(iv); resolve(); }
                }, 200);
            });
        }
        const d    = window._islamData;
        const toMin = hhmm => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
        const now  = new Date().getHours() * 60 + new Date().getMinutes();
        const listePrieres = [
            { nom:'Fajr',    label:'Fajr (Aube)',       heure: d?.fajr    },
            { nom:'Dhuhr',   label:'Dhuhr (Midi)',      heure: d?.dhuhr   },
            { nom:'Asr',     label:'Asr (Après-midi)',  heure: d?.asr     },
            { nom:'Maghrib', label:'Maghrib (Coucher)', heure: d?.maghrib },
            { nom:'Isha',    label:'Isha (Nuit)',       heure: d?.isha    },
        ];
        const prochaine = d ? (listePrieres.find(x => toMin(x.heure) > now) || listePrieres[0]) : null;
        let coords = { ville: 'Paris' };
        try { coords = JSON.parse(localStorage.getItem('islam_coords')) || coords; } catch {}

        document.getElementById('modal-body').innerHTML = (d && !d.erreur) ? `
            <div class="islam-modal">
                <div class="islam-modal-header">
                    <div class="islam-modal-date">${d.date || ''}</div>
                    <div style="text-align:center;margin-top:6px;">
                        <span style="font-size:12px;color:#059669;font-weight:600;">📍 ${coords.ville}</span>
                        <button onclick="window._islamChangerVille()" style="margin-left:10px;background:#f0fdf4;border:1px solid #10b981;color:#059669;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">Changer</button>
                    </div>
                </div>
                <div id="islam-ville-form" style="display:none;background:#f8fafc;border-radius:10px;padding:14px;margin:10px 0;">
                    <div style="font-weight:700;font-size:13px;color:#333;margin-bottom:10px;">Changer la localisation</div>
                    <button onclick="window._islamGeolocate()" style="width:100%;padding:10px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">📍 Utiliser ma position GPS</button>
                    <div style="display:flex;gap:8px;">
                        <input id="islam-ville-input" placeholder="Nom de la ville..." style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
                        <button onclick="window._islamRechercherVille()" style="padding:10px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">OK</button>
                    </div>
                    <div id="islam-ville-msg" style="font-size:12px;color:#ef4444;margin-top:6px;min-height:16px;"></div>
                </div>
                <div class="islam-modal-prieres">
                    <div class="islam-modal-titre-section">Horaires des prières</div>
                    ${listePrieres.map(p => {
                        const actif = prochaine && p.nom === prochaine.nom;
                        return `
                            <div class="islam-modal-priere-row ${actif ? 'islam-modal-priere-actif' : ''}">
                                <span class="islam-modal-priere-nom">${p.label}</span>
                                <span class="islam-modal-priere-heure">${p.heure}</span>
                                ${actif ? '<span class="islam-modal-priere-badge">Prochaine</span>' : ''}
                            </div>`;
                    }).join('')}
                </div>
                ${d.hadithFr ? `
                <div class="islam-modal-hadith">
                    <div class="islam-modal-titre-section">Hadith du jour</div>
                    ${d.hadithAr ? `<div class="islam-modal-hadith-arabe">${d.hadithAr}</div>` : ''}
                    <div class="islam-modal-hadith-fr">"${d.hadithFr}"</div>
                    <div class="islam-modal-hadith-ref">${d.hadithRef || ''}</div>
                </div>` : ''}
                ${d.douaFr ? `
                <div class="islam-modal-doua">
                    <div class="islam-modal-titre-section">Invocation (Doua)</div>
                    ${d.douaAr ? `<div class="islam-modal-doua-arabe">${d.douaAr}</div>` : ''}
                    <div class="islam-modal-doua-fr">"${d.douaFr}"</div>
                    ${d.douaRef ? `<div class="islam-modal-hadith-ref">${d.douaRef}</div>` : ''}
                </div>` : ''}
            </div>
        ` : '<p style="color:#ef4444;text-align:center;padding:20px 0">Horaires indisponibles pour le moment.</p>';

    // ── Tâches ────────────────────────────────────────────────
    } else if (type === 'taches') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalTaches();

    // ── Anniversaires ─────────────────────────────────────────
    } else if (type === 'anniversaires') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalAnniversaires();

    // ── Cycle ─────────────────────────────────────────────────
    } else if (type === 'cycle') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await Cycle.ouvrirModalCalendrier();

    // ── Rendez-vous ───────────────────────────────────────────
    } else if (type === 'rendezvous') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await Rendezvous.ouvrirListe();

    // ── Planning ──────────────────────────────────────────────
    } else if (type === 'planning') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        if (typeof ouvrirPlanningModal === 'function') {
            await ouvrirPlanningModal();
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="color:red">Module planning non chargé.</p>';
        }

    // ── Profil ────────────────────────────────────────────────
    } else if (type === 'profil') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        const user = getUser();
        if (!user?.token) {
            document.getElementById('modal-body').innerHTML = '<p>Erreur : utilisateur non identifié.</p>';
            return;
        }
        try {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            const p = d.profil || {};
            profilCache     = p;
            const photoSrc  = p.photo || '';
            const initiales = construireTrigramme(p.prenom, p.nom) || '👤';

            document.getElementById('modal-body').innerHTML = `
                <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #f3f4f6;">
                    <button class="profil-tab active" data-tab="infos"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#4f46e5;
                               border-bottom:2px solid #4f46e5;margin-bottom:-2px">👤 Profil</button>
                    <button class="profil-tab" data-tab="securite"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">🔑 Sécurité</button>
                    <button class="profil-tab" data-tab="widgets"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">📱 Widgets</button>
                    <button class="profil-tab" data-tab="social"
                        style="flex:1;padding:10px 4px;border:none;background:none;cursor:pointer;
                               font-size:12px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">🤝 Social</button>
                </div>

                <div id="profil-tab-infos" class="profil-tab-content">
                    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px">
                        ${photoSrc
                            ? `<img id="profil-photo-preview" src="${photoSrc}"
                                style="width:90px;height:90px;border-radius:50%;object-fit:cover;
                                       border:3px solid #4f46e5;cursor:pointer;
                                       box-shadow:0 4px 12px rgba(79,70,229,0.3)"
                                onclick="document.getElementById('photo-input').click()">`
                            : `<div class="profil-widget-initiales"
                                    style="width:90px;height:90px;font-size:24px;cursor:pointer;
                                           box-shadow:0 4px 12px rgba(79,70,229,0.3)"
                                    onclick="document.getElementById('photo-input').click()">${initiales}</div>`
                        }
                        <input type="file" id="photo-input" accept="image/*" style="display:none"
                            onchange="previewPhoto(event)">
                        <span style="font-size:11px;color:#9ca3af;margin-top:8px">Appuyez sur la photo pour changer</span>
                        ${photoSrc
                            ? `<button id="btn-supprimer-photo" onclick="supprimerPhoto()"
                                style="margin-top:8px;background:#fee2e2;color:#ef4444;border:none;
                                       border-radius:8px;padding:6px 14px;font-size:12px;
                                       font-weight:600;cursor:pointer">
                                🗑️ Supprimer la photo
                               </button>`
                            : ''
                        }
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                        <div>
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Prénom</label>
                            <input id="p-prenom" placeholder="Prénom" value="${p.prenom||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                        <div>
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nom</label>
                            <input id="p-nom" placeholder="Nom" value="${p.nom||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                    </div>
                    <div style="margin-bottom:10px">
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Date de naissance</label>
                        <input id="p-naissance" type="date" value="${p.date_naissance ? p.date_naissance.split('T')[0] : ''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                    </div>
                    <div style="margin-bottom:10px">
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Sexe</label>
                        <select id="p-sexe"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;background:#fff">
                            <option value="">— Non renseigné —</option>
                            <option value="femme"     ${p.sexe === 'femme'     ? 'selected' : ''}>Femme</option>
                            <option value="homme"     ${p.sexe === 'homme'     ? 'selected' : ''}>Homme</option>
                            <option value="intersexe" ${p.sexe === 'intersexe' ? 'selected' : ''}>Intersexe</option>
                        </select>
                    </div>
                    <div style="margin-bottom:10px">
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Email</label>
                        <input id="p-email" placeholder="Email" value="${p.email||''}"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                        <div>
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Téléphone</label>
                            <input id="p-tel" placeholder="Téléphone" value="${p.telephone||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                        <div>
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Profession</label>
                            <input id="p-prof" placeholder="Profession" value="${p.profession||''}"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                    </div>
                    <div style="margin-bottom:10px">
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Signe du zodiaque</label>
                        <select id="p-signe"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;background:#fff">
                            <option value="">— Laisser calculer depuis la date de naissance —</option>
                            <option value="belier"     ${p.signe_zodiaque==='belier'     ? 'selected':''}>♈ Bélier</option>
                            <option value="taureau"    ${p.signe_zodiaque==='taureau'    ? 'selected':''}>♉ Taureau</option>
                            <option value="gemeaux"    ${p.signe_zodiaque==='gemeaux'    ? 'selected':''}>♊ Gémeaux</option>
                            <option value="cancer"     ${p.signe_zodiaque==='cancer'     ? 'selected':''}>♋ Cancer</option>
                            <option value="lion"       ${p.signe_zodiaque==='lion'       ? 'selected':''}>♌ Lion</option>
                            <option value="vierge"     ${p.signe_zodiaque==='vierge'     ? 'selected':''}>♍ Vierge</option>
                            <option value="balance"    ${p.signe_zodiaque==='balance'    ? 'selected':''}>♎ Balance</option>
                            <option value="scorpion"   ${p.signe_zodiaque==='scorpion'   ? 'selected':''}>♏ Scorpion</option>
                            <option value="sagittaire" ${p.signe_zodiaque==='sagittaire' ? 'selected':''}>♐ Sagittaire</option>
                            <option value="capricorne" ${p.signe_zodiaque==='capricorne' ? 'selected':''}>♑ Capricorne</option>
                            <option value="verseau"    ${p.signe_zodiaque==='verseau'    ? 'selected':''}>♒ Verseau</option>
                            <option value="poissons"   ${p.signe_zodiaque==='poissons'   ? 'selected':''}>♓ Poissons</option>
                        </select>
                        <div style="font-size:11px;color:#9ca3af;margin-top:4px">
                            Utile uniquement si vous n'avez pas renseigné de date de naissance.
                        </div>
                    </div>
                    <div style="margin-bottom:16px">
                        <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Note personnelle</label>
                        <textarea id="p-note" placeholder="Note personnelle..." rows="3"
                            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                                   font-size:14px;box-sizing:border-box;resize:none;outline:none">${p.note||''}</textarea>
                    </div>
                    <button onclick="sauvegarderProfil()"
                        style="width:100%;padding:13px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                               color:white;border:none;border-radius:12px;font-size:15px;
                               font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)">
                        💾 Sauvegarder le profil
                    </button>
                    <div id="profil-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                </div>

                <div id="profil-tab-securite" class="profil-tab-content" style="display:none">
                    <div style="background:#f8fafc;border-radius:16px;padding:20px">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                            <div style="width:48px;height:48px;background:linear-gradient(135deg,#f59e0b,#d97706);
                                        border-radius:14px;display:flex;align-items:center;justify-content:center;
                                        font-size:22px;box-shadow:0 4px 10px rgba(245,158,11,0.3)">🔑</div>
                            <div>
                                <div style="font-weight:700;color:#111;font-size:15px">Changer le mot de passe</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:2px">8 car. min · majuscule · minuscule · chiffre · caractère spécial</div>
                            </div>
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Ancien mot de passe</label>
                            <input type="password" id="mdp-ancien" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                        <div style="margin-bottom:10px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Nouveau mot de passe</label>
                            <input type="password" id="mdp-nouveau" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                        <div style="margin-bottom:20px">
                            <label style="font-size:11px;color:#6b7280;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase">Confirmer le mot de passe</label>
                            <input type="password" id="mdp-confirm" placeholder="••••••••"
                                style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none">
                        </div>
                        <button onclick="changerMdp()"
                            style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);
                                   color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;
                                   cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3)">
                            🔑 Changer le mot de passe
                        </button>
                        <div id="mdp-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                <div id="profil-tab-widgets" class="profil-tab-content" style="display:none">
                    <div style="background:#f8fafc;border-radius:16px;padding:20px">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
                            <div style="width:48px;height:48px;background:linear-gradient(135deg,#10b981,#059669);
                                        border-radius:14px;display:flex;align-items:center;justify-content:center;
                                        font-size:22px;box-shadow:0 4px 10px rgba(16,185,129,0.3)">📱</div>
                            <div>
                                <div style="font-weight:700;color:#111;font-size:15px">Mes widgets</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:2px">Choisis ce qui s'affiche sur ton tableau de bord</div>
                            </div>
                        </div>
                                                <div id="widgets-choix" class="widgets-choix-grid">
                            <p style="color:#9ca3af;font-size:13px">Chargement...</p>
                        </div>
                        <button onclick="sauvegarderWidgetsVisibles()"
                            style="width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);
                                   color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;
                                   cursor:pointer;margin-top:16px;box-shadow:0 4px 10px rgba(16,185,129,0.3)">
                            💾 Sauvegarder mes widgets
                        </button>
                        <div id="widgets-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                    </div>
                </div>

                <div id="profil-tab-social" class="profil-tab-content" style="display:none">
                    <div style="display:flex;gap:0;margin-bottom:16px;border-radius:10px;
                                overflow:hidden;border:1px solid #ede9fe">
                        <button data-social-tab="miens"
                            id="social-tab-miens"
                            data-action="social-onglet"
                            data-onglet="miens"
                            style="flex:1;padding:10px;border:none;background:#7c3aed;
                                   color:#fff;font-size:13px;font-weight:600;cursor:pointer">
                            Ce que je partage
                        </button>
                        <button data-social-tab="nouveau"
                            id="social-tab-nouveau"
                            data-action="social-onglet"
                            data-onglet="nouveau"
                            style="flex:1;padding:10px;border:none;background:#f5f3ff;
                                   color:#7c3aed;font-size:13px;font-weight:600;cursor:pointer">
                            Partager avec…
                        </button>
                    </div>
                    <div id="social-tab-content"></div>
                </div>
            `;

            // ── Listeners onglets profil ───────────────────────────
            document.querySelectorAll('.profil-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profil-tab').forEach(t => {
                        t.style.color             = '#9ca3af';
                        t.style.borderBottomColor = 'transparent';
                    });
                    tab.style.color             = '#4f46e5';
                    tab.style.borderBottomColor = '#4f46e5';
                    document.querySelectorAll('.profil-tab-content').forEach(c => c.style.display = 'none');
                    const cible = document.getElementById(`profil-tab-${tab.dataset.tab}`);
                    if (cible) cible.style.display = 'block';
                    if (tab.dataset.tab === 'widgets') afficherSectionWidgets();
                    if (tab.dataset.tab === 'social')  _socialOnglet('miens');
                });
            });

            // ── Listeners onglets social (data-action) ────────────
            document.querySelectorAll('[data-action="social-onglet"]').forEach(btn => {
                btn.addEventListener('click', () => _socialOnglet(btn.dataset.onglet));
            });

            await afficherSectionWidgets();
        } catch {
            document.getElementById('modal-body').innerHTML = '<p>Erreur de chargement du profil.</p>';
        }

    // ── Astrologie ────────────────────────────────────────────
    } else if (type === 'astrologie') {
        await ouvrirModaleAstrologie();

    // ── Admin ─────────────────────────────────────────────────
    } else if (type === 'admin') {
        document.getElementById('modal-body').innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="stats" onclick="switchAdminTab('stats')">📊 Stats</button>
                <button class="admin-tab" data-tab="users"  onclick="switchAdminTab('users')">👥 Utilisateurs</button>
            </div>
            <div id="admin-tab-stats" class="admin-tab-content active"><p style="color:#9ca3af">Chargement...</p></div>
            <div id="admin-tab-users" class="admin-tab-content"><p style="color:#9ca3af">Chargement...</p></div>
        `;
        chargerAdminStats();
        chargerAdminUsers();

    } else {
        document.getElementById('modal-body').innerHTML = '<p>En construction — disponible prochainement.</p>';
    }
}

// ===================== LECTURE VOCALE PRIÈRE =================

function lirePriereModal(e) {
    if (!('speechSynthesis' in window)) {
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">La synthèse vocale n'est pas supportée par votre navigateur.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="openModal('priere')">Retour</button>
            </div>`;
        return;
    }
    const synth = window.speechSynthesis;
    if (synth.speaking) {
        synth.cancel();
        if (e?.currentTarget) e.currentTarget.textContent = '🔊';
        return;
    }
    const texteALire = `${priere.titre || ''}. ${priere.evangile || priere.texte || ''} ${priere.ref || ''}`;
    const utterance  = new SpeechSynthesisUtterance(texteALire);
    utterance.lang   = 'fr-FR';
    utterance.rate   = 0.9;
    utterance.pitch  = 0.7;
    const lancerLecture = () => {
        const voix     = synth.getVoices();
        const voixMasc = voix.find(v =>
            v.lang.startsWith('fr') && (
                v.name.toLowerCase().includes('thomas')  ||
                v.name.toLowerCase().includes('nicolas') ||
                v.name.toLowerCase().includes('pierre')  ||
                v.name.toLowerCase().includes('jean')    ||
                v.name.toLowerCase().includes('male')    ||
                v.name.toLowerCase().includes('man')
            )
        ) || voix.find(v => v.lang.startsWith('fr'));
        if (voixMasc) utterance.voice = voixMasc;

        const btn = e?.currentTarget || document.getElementById('btn-speaker-modal');
        if (btn) btn.textContent = '⏹️';
        utterance.onend   = () => { if (btn) btn.textContent = '🔊'; };
        utterance.onerror = () => { if (btn) btn.textContent = '🔊'; };

        synth.speak(utterance);
    };
    if (synth.getVoices().length === 0) synth.onvoiceschanged = lancerLecture;
    else lancerLecture();
}

// ===================== FERMETURE MODALE ======================

function closeModal() {
    window.speechSynthesis?.cancel();
    document.getElementById('overlay').classList.remove('on');
}

function closeOutside(e) {
    if (e.target === document.getElementById('overlay')) closeModal();
}

// ===================== ONGLETS SOCIAL ========================

// Labels triés alphabétiquement par libellé affiché
const _SHARE_LABELS = [
    { type: 'cycle',    label: 'Cycle menstruel' },
    { type: 'planning', label: 'Planning'         },
    { type: 'rdv',      label: 'Rendez-vous'      },
    { type: 'taches',   label: 'Tâches'           },
];

async function _socialOnglet(onglet) {
    // Mettre à jour l'apparence des boutons d'onglet
    ['miens', 'nouveau'].forEach(o => {
        const btn = document.getElementById(`social-tab-${o}`);
        if (!btn) return;
        if (o === onglet) {
            btn.style.background = '#7c3aed';
            btn.style.color      = '#fff';
        } else {
            btn.style.background = '#f5f3ff';
            btn.style.color      = '#7c3aed';
        }
    });

    const container = document.getElementById('social-tab-content');
    if (!container) return;
    container.innerHTML = '<p style="color:#9ca3af;font-size:13px">Chargement...</p>';

    const user = getUser();

    if (onglet === 'miens') {
        try {
            const r = await fetch('/api/social/partages/miens', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (!d.success) throw new Error();

            const partages = d.partages;
            if (!partages.length) {
                container.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px 0">Vous ne partagez rien pour l\'instant.</p>';
                return;
            }

            // Grouper par viewer
            const parViewer = {};
            partages.forEach(p => {
                if (!parViewer[p.viewer_id]) {
                    parViewer[p.viewer_id] = {
                        username: p.username,
                        prenom  : p.prenom,
                        nom     : p.nom,
                        photo   : p.photo,
                        items   : []
                    };
                }
                parViewer[p.viewer_id].items.push(p);
            });

            container.innerHTML = Object.entries(parViewer).map(([vid, v]) => {
                const initiales = construireTrigramme(v.prenom, v.nom) || v.username?.slice(0,2).toUpperCase() || '?';
                const avatar    = v.photo
                    ? `<img src="${v.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #ede9fe">`
                    : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);
                                   display:flex;align-items:center;justify-content:center;
                                   font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${initiales}</div>`;

                const lignes = v.items.map(item => {
                    const labelObj = _SHARE_LABELS.find(l => l.type === item.resource_type);
                    const label    = labelObj ? labelObj.label : item.resource_type;
                    const actif    = item.active;
                    return `
                        <div style="display:flex;align-items:center;justify-content:space-between;
                                    padding:8px 0;border-bottom:1px solid #f3f4f6">
                            <span style="font-size:13px;color:#374151">${label}</span>
                            <div style="display:flex;gap:8px;align-items:center">
                                <span style="font-size:11px;color:${actif ? '#10b981' : '#f59e0b'};font-weight:600">
                                    ${actif ? 'Actif' : 'Pausé'}
                                </span>
                                <button data-action="toggle-partage"
                                        data-id="${item.id}"
                                        data-active="${actif ? 'true' : 'false'}"
                                        style="background:${actif ? '#fef3c7' : '#d1fae5'};
                                               color:${actif ? '#d97706' : '#059669'};
                                               border:none;border-radius:6px;padding:4px 10px;
                                               font-size:11px;font-weight:600;cursor:pointer">
                                    ${actif ? 'Pause' : 'Réactiver'}
                                </button>
                                <button data-action="delete-partage"
                                        data-id="${item.id}"
                                        style="background:#fee2e2;color:#ef4444;border:none;
                                               border-radius:6px;padding:4px 10px;
                                               font-size:11px;font-weight:600;cursor:pointer">
                                    Supprimer
                                </button>
                            </div>
                        </div>`;
                }).join('');

                return `
                    <div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:12px">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                            ${avatar}
                            <div>
                                <div style="font-weight:700;font-size:14px;color:#111">
                                    ${v.prenom ? `${v.prenom} ${v.nom || ''}`.trim() : v.username}
                                </div>
                                <div style="font-size:11px;color:#9ca3af">@${v.username}</div>
                            </div>
                        </div>
                        ${lignes}
                    </div>`;
            }).join('');

            // Listeners toggle & delete
            container.querySelectorAll('[data-action="toggle-partage"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id     = btn.dataset.id;
                    const actif  = btn.dataset.active === 'true';
                    await fetch(`/api/social/partages/${id}`, {
                        method : 'PATCH',
                        headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                        body   : JSON.stringify({ active: !actif })
                    });
                    _socialOnglet('miens');
                });
            });

            container.querySelectorAll('[data-action="delete-partage"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    await fetch(`/api/social/partages/${id}`, {
                        method : 'DELETE',
                        headers: { 'Authorization': `Bearer ${user.token}` }
                    });
                    _socialOnglet('miens');
                });
            });

        } catch {
            container.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>';
        }

    } else {
        // ── Onglet "Partager avec…" ────────────────────────────
        container.innerHTML = `
            <div style="margin-bottom:12px">
                <input id="social-search-input" placeholder="Rechercher un utilisateur…"
                    style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                           font-size:14px;box-sizing:border-box;outline:none">
            </div>
            <div id="social-search-results"></div>
            <div id="social-share-form" style="display:none"></div>
        `;

        let searchTimer = null;
        document.getElementById('social-search-input').addEventListener('input', e => {
            clearTimeout(searchTimer);
            const q = e.target.value.trim();
            if (q.length < 2) {
                document.getElementById('social-search-results').innerHTML = '';
                return;
            }
            searchTimer = setTimeout(() => _socialSearchUsers(q, user), 350);
        });
    }
}

async function _socialSearchUsers(q, user) {
    const results = document.getElementById('social-search-results');
    results.innerHTML = '<p style="color:#9ca3af;font-size:13px">Recherche...</p>';
    try {
        const r = await fetch(`/api/social/users/search?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success || !d.users.length) {
            results.innerHTML = '<p style="color:#9ca3af;font-size:13px">Aucun utilisateur trouvé.</p>';
            return;
        }
        results.innerHTML = d.users.map(u => {
            const initiales = construireTrigramme(u.prenom, u.nom) || u.username?.slice(0,2).toUpperCase() || '?';
            const avatar    = u.photo
                ? `<img src="${u.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #ede9fe">`
                : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);
                               display:flex;align-items:center;justify-content:center;
                               font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${initiales}</div>`;
            return `
                <div data-action="select-user"
                     data-user-id="${u.id}"
                     data-username="${u.username}"
                     data-prenom="${u.prenom || ''}"
                     data-nom="${u.nom || ''}"
                     data-photo="${u.photo || ''}"
                     style="display:flex;align-items:center;gap:10px;padding:10px;
                            border-radius:10px;cursor:pointer;margin-bottom:6px;
                            background:#f8fafc;border:1px solid #ede9fe">
                    ${avatar}
                    <div>
                        <div style="font-weight:600;font-size:14px;color:#111">
                            ${u.prenom ? `${u.prenom} ${u.nom || ''}`.trim() : u.username}
                        </div>
                        <div style="font-size:11px;color:#9ca3af">@${u.username}</div>
                    </div>
                </div>`;
        }).join('');

        results.querySelectorAll('[data-action="select-user"]').forEach(el => {
            el.addEventListener('click', () => {
                _socialSelectionnerUser({
                    id      : parseInt(el.dataset.userId),
                    username: el.dataset.username,
                    prenom  : el.dataset.prenom,
                    nom     : el.dataset.nom,
                    photo   : el.dataset.photo
                }, user);
            });
        });
    } catch {
        results.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de recherche.</p>';
    }
}

async function _socialSelectionnerUser(cible, user) {
    document.getElementById('social-search-results').innerHTML = '';
    document.getElementById('social-search-input').value = '';

    const form = document.getElementById('social-share-form');
    form.style.display = 'block';
    form.innerHTML     = '<p style="color:#9ca3af;font-size:13px">Chargement...</p>';

    // Récupérer les partages existants vers cette personne
    let dejaPartages = [];
    try {
        const r = await fetch('/api/social/partages/miens', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            dejaPartages = d.partages
                .filter(p => p.viewer_id === cible.id && p.active)
                .map(p => p.resource_type);
        }
    } catch { /* silencieux */ }

    // Déterminer le sexe du user courant pour filtrer le cycle
    const sexe = profilCache?.sexe || '';
    // Seuls les hommes ne peuvent pas partager leur cycle
    const peutPartagerCycle = sexe !== 'homme';

    const initiales = construireTrigramme(cible.prenom, cible.nom) || cible.username?.slice(0,2).toUpperCase() || '?';
    const avatar    = cible.photo
        ? `<img src="${cible.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #ede9fe">`
        : `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);
                       display:flex;align-items:center;justify-content:center;
                       font-size:13px;font-weight:700;color:#fff;flex-shrink:0">${initiales}</div>`;

    // Types disponibles triés alphabétiquement, cycle filtré si homme
    const typesDisponibles = _SHARE_LABELS.filter(l => l.type !== 'cycle' || peutPartagerCycle);

    form.innerHTML = `
        <div style="background:#f5f3ff;border-radius:12px;padding:14px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
                ${avatar}
                <div>
                    <div style="font-weight:700;font-size:14px;color:#111">
                        ${cible.prenom ? `${cible.prenom} ${cible.nom || ''}`.trim() : cible.username}
                    </div>
                    <div style="font-size:11px;color:#9ca3af">@${cible.username}</div>
                </div>
            </div>
            <div style="font-size:12px;font-weight:600;color:#6b7280;
                        text-transform:uppercase;margin-bottom:8px">
                Que souhaitez-vous partager ?
            </div>
            ${typesDisponibles.map(l => `
                <label style="display:flex;align-items:center;gap:10px;padding:8px 0;
                              border-bottom:1px solid #ede9fe;cursor:pointer">
                    <input type="checkbox"
                           data-share-type="${l.type}"
                           ${dejaPartages.includes(l.type) ? 'checked' : ''}
                           style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer">
                    <span style="font-size:13px;color:#374151;font-weight:${dejaPartages.includes(l.type) ? '700' : '400'}">
                        ${l.label}${dejaPartages.includes(l.type) ? ' <span style="color:#10b981;font-size:11px">(déjà partagé)</span>' : ''}
                    </span>
                </label>`).join('')}
            <button data-action="envoyer-partages"
                    style="width:100%;margin-top:14px;padding:12px;
                           background:linear-gradient(135deg,#7c3aed,#4f46e5);
                           color:#fff;border:none;border-radius:10px;
                           font-size:14px;font-weight:600;cursor:pointer">
                Valider
            </button>
            <div id="social-share-msg" style="text-align:center;margin-top:8px;font-size:13px;min-height:16px"></div>
        </div>
    `;

    form.querySelector('[data-action="envoyer-partages"]').addEventListener('click', async () => {
        const cases    = form.querySelectorAll('[data-share-type]');
        const cochees  = [...cases].filter(c => c.checked).map(c => c.dataset.shareType);
        const msg      = document.getElementById('social-share-msg');

        if (!cochees.length) {
            msg.style.color   = '#f59e0b';
            msg.textContent   = 'Sélectionnez au moins un élément.';
            return;
        }

        msg.style.color = '#9ca3af';
        msg.textContent = 'Envoi en cours…';

        let ok = 0, err = 0;
        for (const type of cochees) {
            try {
                const r = await fetch('/api/social/partages', {
                    method : 'POST',
                    headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
                    body   : JSON.stringify({ viewer_id: cible.id, resource_type: type })
                });
                const d = await r.json();
                if (d.success) ok++; else err++;
            } catch { err++; }
        }

        if (err === 0) {
            msg.style.color = '#10b981';
            msg.textContent = `${ok} partage(s) activé(s) avec succès.`;
            // Rafraîchir les checkboxes pour refléter le nouvel état
            setTimeout(() => _socialSelectionnerUser(cible, user), 1200);
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = `${ok} réussi(s), ${err} erreur(s).`;
        }
    });
}
