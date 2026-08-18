// ===================== GESTION DES MODALES =====================

const JOURS_MODAL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

async function openModal(type) {
    document.getElementById('overlay').classList.add('on');
    const titres = {
        meteo:'Météo du jour', priere:'Prière du jour',
        islam:'Prières & Hadiths',
        taches:'Tâches du jour', rdv:'Rendez-vous',
        planning:'Mon Planning', anniversaires:'Anniversaires',
        profil:'Mon Profil', admin:'Administration',
        cycle:'Suivi du cycle', rendezvous:'Rendez-vous médicaux'
    };
    document.getElementById('modal-title').textContent = titres[type] || type;

    if (type === 'meteo') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        _ouvrirModaleMeteo();

    } else if (type === 'priere') {
        document.getElementById('modal-body').innerHTML = priere ? `
            <div class="priere-modal">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    ${priere.titre ? `<div class="priere-titre-jour" style="margin-bottom:0;">📖 ${priere.titre}</div>` : '<div></div>'}
                    <button onclick="lirePriereModal(event)" title="Écouter la prière"
                        style="background:#f3f4f6;border:none;border-radius:50%;width:36px;height:36px;
                               cursor:pointer;font-size:18px;display:flex;align-items:center;
                               justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);"
                        id="btn-speaker-modal">🔊</button>
                </div>
                ${priere.evangile ? `
                <div class="priere-section">
                    <div class="priere-section-label">Évangile du jour</div>
                    <div class="priere-texte-complet">${priere.evangile.replace(/\n/g, '<br>')}</div>
                </div>` : `
                <div class="priere-texte-complet">"${priere.texte}"<br><br><em>— ${priere.ref}</em></div>
                `}
                ${priere.lecture1 ? `
                <details class="priere-lecture1">
                    <summary>📜 Première lecture (cliquer pour lire)</summary>
                    <div class="priere-texte-complet" style="margin-top:10px;max-height:200px">
                        ${priere.lecture1.replace(/\n/g, '<br>')}
                    </div>
                </details>` : ''}
                ${priere.source === 'catholique.fr' ? `<div class="priere-source">Source : eglise.catholique.fr</div>` : ''}
            </div>
        ` : '<p>Chargement...</p>';

    } else if (type === 'islam') {
        document.getElementById('modal-body').innerHTML = islamData ? `
            <div class="islam-modal">
                <div class="islam-modal-header">
                    <div class="islam-modal-date">${islamData.date}</div>
                </div>

                <div class="islam-modal-prieres">
                    <div class="islam-modal-titre-section">Horaires des prières</div>
                    ${[
                        { nom:'Fajr',    label:'Fajr (Aube)',      heure: islamData.fajr    },
                        { nom:'Dhuhr',   label:'Dhuhr (Midi)',     heure: islamData.dhuhr   },
                        { nom:'Asr',     label:'Asr (Après-midi)', heure: islamData.asr     },
                        { nom:'Maghrib', label:'Maghrib (Coucher)',heure: islamData.maghrib  },
                        { nom:'Isha',    label:'Isha (Nuit)',      heure: islamData.isha     },
                    ].map(p => {
                        const prochaineNom = getProchainePreiere(islamData).nom;
                        const actif = p.nom === prochaineNom;
                        return `
                            <div class="islam-modal-priere-row ${actif ? 'islam-modal-priere-actif' : ''}">
                                <span class="islam-modal-priere-nom">${p.label}</span>
                                <span class="islam-modal-priere-heure">${p.heure}</span>
                                ${actif ? '<span class="islam-modal-priere-badge">Prochaine</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                ${islamData.hadithFr ? `
                <div class="islam-modal-hadith">
                    <div class="islam-modal-titre-section">Hadith du jour</div>
                    ${islamData.hadith ? `<div class="islam-modal-hadith-arabe">${islamData.hadith}</div>` : ''}
                    <div class="islam-modal-hadith-fr">"${islamData.hadithFr}"</div>
                    ${islamData.numero ? `<div class="islam-modal-hadith-ref">Muslim — n°${islamData.numero}</div>` : ''}
                </div>` : ''}

                <div class="islam-modal-doua">
                    <div class="islam-modal-titre-section">Invocation (Doua)</div>
                    <div class="islam-modal-doua-arabe">اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى</div>
                    <div class="islam-modal-doua-fr">"Ô Allah, je Te demande la guidance, la piété, la chasteté et l'aisance."</div>
                </div>
            </div>
        ` : '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement des horaires en cours...<br><br><small>Autorisez la géolocalisation pour obtenir les horaires précis.</small></p>';

    } else if (type === 'taches') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalTaches();

    } else if (type === 'anniversaires') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await chargerModalAnniversaires();

    } else if (type === 'cycle') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await Cycle.ouvrirModalCalendrier();

    } else if (type === 'rendezvous') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        await Rendezvous.ouvrirListe();

    } else if (type === 'planning') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        if (typeof ouvrirPlanningModal === 'function') {
            await ouvrirPlanningModal();
        } else {
            document.getElementById('modal-body').innerHTML = '<p style="color:red">Module planning non chargé.</p>';
        }

    } else if (type === 'profil') {
        document.getElementById('modal-body').innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
        const user = JSON.parse(localStorage.getItem('myvibe_user'));
        if (!user?.userId) {
            document.getElementById('modal-body').innerHTML = '<p>Erreur : utilisateur non identifié.</p>';
            return;
        }
        try {
            const r = await fetch(`/api/profil?userId=${user.userId}`);
            const d = await r.json();
            const p = d.profil || {};
            profilCache = p;
            const photoSrc  = p.photo || '';
            const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase() || '👤';

            document.getElementById('modal-body').innerHTML = `
                <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #f3f4f6;">
                    <button class="profil-tab active" data-tab="infos"
                        style="flex:1;padding:12px 4px;border:none;background:none;cursor:pointer;
                               font-size:13px;font-weight:600;color:#4f46e5;
                               border-bottom:2px solid #4f46e5;margin-bottom:-2px">👤 Profil</button>
                    <button class="profil-tab" data-tab="securite"
                        style="flex:1;padding:12px 4px;border:none;background:none;cursor:pointer;
                               font-size:13px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">🔑 Sécurité</button>
                    <button class="profil-tab" data-tab="widgets"
                        style="flex:1;padding:12px 4px;border:none;background:none;cursor:pointer;
                               font-size:13px;font-weight:600;color:#9ca3af;
                               border-bottom:2px solid transparent;margin-bottom:-2px">📱 Widgets</button>
                </div>

                <div id="profil-tab-infos" class="profil-tab-content">
                    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px">
                        ${photoSrc
                            ? `<img id="profil-photo-preview" src="${photoSrc}"
                                style="width:90px;height:90px;border-radius:50%;object-fit:cover;
                                       border:3px solid #4f46e5;cursor:pointer;
                                       box-shadow:0 4px 12px rgba(79,70,229,0.3)"
                                onclick="document.getElementById('photo-input').click()">`
                            : `<div style="width:90px;height:90px;border-radius:50%;
                                          background:linear-gradient(135deg,#4f46e5,#7c3aed);
                                          color:white;display:flex;align-items:center;
                                          justify-content:center;font-size:28px;font-weight:700;
                                          cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)"
                                onclick="document.getElementById('photo-input').click()">${initiales}</div>`
                        }
                        <input type="file" id="photo-input" accept="image/*" style="display:none"
                            onchange="previewPhoto(event)">
                        <span style="font-size:11px;color:#9ca3af;margin-top:8px">Appuyez sur la photo pour changer</span>
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
            `;

            document.querySelectorAll('.profil-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profil-tab').forEach(t => {
                        t.style.color = '#9ca3af';
                        t.style.borderBottomColor = 'transparent';
                    });
                    tab.style.color = '#4f46e5';
                    tab.style.borderBottomColor = '#4f46e5';
                    document.querySelectorAll('.profil-tab-content').forEach(c => c.style.display = 'none');
                    document.getElementById(`profil-tab-${tab.dataset.tab}`).style.display = 'block';
                });
            });

            await afficherSectionWidgets();

        } catch {
            document.getElementById('modal-body').innerHTML = '<p>Erreur de chargement du profil.</p>';
        }

    } else if (type === 'admin') {
        document.getElementById('modal-body').innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab active" data-tab="stats"  onclick="switchAdminTab('stats')">📊 Stats</button>
                <button class="admin-tab"        data-tab="users"  onclick="switchAdminTab('users')">👥 Utilisateurs</button>
                <button class="admin-tab"        data-tab="creer"  onclick="switchAdminTab('creer')">➕ Créer</button>
            </div>
            <div id="admin-tab-stats" class="admin-tab-content active"><p style="color:#9ca3af">Chargement...</p></div>
            <div id="admin-tab-users" class="admin-tab-content"><p style="color:#9ca3af">Chargement...</p></div>
            <div id="admin-tab-creer" class="admin-tab-content">
                <div class="create-form">
                    <input type="text"     id="new-username" placeholder="Nom d'utilisateur">
                    <input type="password" id="new-password" placeholder="8 car. min · majuscule · minuscule · chiffre · spécial">
                    <select id="new-role">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                    <button class="save-btn" onclick="creerUser()">➕ Créer l'utilisateur</button>
                    <div id="create-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
                </div>
            </div>
        `;
        chargerAdminStats();
        chargerAdminUsers();

    } else {
        document.getElementById('modal-body').innerHTML = '<p>En construction — disponible prochainement.</p>';
    }
}

function lirePriereModal(e) {
    if (!('speechSynthesis' in window)) {
        document.getElementById('modal-title').textContent = 'Non supporté';
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
        const voix = synth.getVoices();
        const voixMasc = voix.find(v =>
            v.lang.startsWith('fr') && (
                v.name.toLowerCase().includes('thomas') ||
                v.name.toLowerCase().includes('nicolas') ||
                v.name.toLowerCase().includes('pierre') ||
                v.name.toLowerCase().includes('jean') ||
                v.name.toLowerCase().includes('male') ||
                v.name.toLowerCase().includes('man')
            )
        ) || voix.find(v => v.lang.startsWith('fr'));
        if (voixMasc) utterance.voice = voixMasc;
        if (e?.currentTarget) {
            e.currentTarget.textContent = '⏹️';
            utterance.onend  = () => { e.currentTarget.textContent = '🔊'; };
            utterance.onerror = () => { e.currentTarget.textContent = '🔊'; };
        }
        synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = lancerLecture;
    } else {
        lancerLecture();
    }
}

function closeModal() {
    window.speechSynthesis?.cancel();
    document.getElementById('overlay').classList.remove('on');
}
function closeOutside(e) { if(e.target===document.getElementById('overlay')) closeModal(); }
