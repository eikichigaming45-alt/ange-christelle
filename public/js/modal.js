// ===================== GESTION DES MODALES =====================

const JOURS_MODAL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

async function openModal(type) {
    document.getElementById('overlay').classList.add('on');
    const titres = {
        meteo:'🌤️ Météo du jour', priere:'🙏 Prière du jour',
        taches:'✅ Tâches du jour', rdv:'📅 Rendez-vous',
        planning:'📋 Planning', anniversaires:'🎂 Anniversaires',
        profil:'👤 Mon Profil', admin:'⚙️ Administration',
        cycle:'🌸 Suivi du cycle', rendezvous:'🩺 Rendez-vous médicaux'
    };
    document.getElementById('modal-title').textContent = titres[type]||type;

    if (type === 'meteo') {
        const d = meteoData;
        document.getElementById('modal-body').innerHTML = d ? `
            <div class="meteo-modal">
                <div class="meteo-modal-top">
                    <div class="meteo-modal-left">
                        <div class="meteo-modal-temp">${d.temp}°</div>
                        <div class="meteo-modal-desc">${d.icon} ${codes[d.code] || 'Variable'}</div>
                        <div class="meteo-modal-minmax">↑ ${d.max}°  ↓ ${d.min}°</div>
                        <div class="meteo-ville" style="margin-top:4px">📍 ${d.ville}</div>
                    </div>
                    <div class="meteo-modal-icon">${d.icon}</div>
                </div>
                <div class="meteo-badges" style="margin:12px 0">
                    <span class="meteo-badge">💧 ${d.hum}%</span>
                    <span class="meteo-badge">💨 ${d.vent} km/h</span>
                    <span class="meteo-badge">🌧️ ${d.pluie}%</span>
                </div>
                ${d.daily ? `
                <div class="meteo-7j" style="margin-bottom:8px">
                    ${d.daily.time.slice(0,7).map((t, i) => {
                        const dateObj = new Date(t + 'T12:00:00');
                        let jsDay = dateObj.getDay();
                        let indexJour = jsDay === 0 ? 6 : jsDay - 1;
                        const jour = i === 0 ? 'Auj.' : JOURS_MODAL[indexJour];
                        const iMax = Math.round(d.daily.temperature_2m_max[i]);
                        const iMin = Math.round(d.daily.temperature_2m_min[i]);
                        const iIcon = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
                        return `
                            <div class="meteo-jour ${i === 0 ? 'meteo-jour-today' : ''}"
                                onclick="afficherDetailJour(${i})" style="cursor:pointer">
                                <div class="meteo-jour-nom">${jour}</div>
                                <div class="meteo-jour-icon">${iIcon}</div>
                                <div class="meteo-jour-max">${iMax}°</div>
                                <div class="meteo-jour-min">${iMin}°</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div id="meteo-detail-jour" style="margin-bottom:12px"></div>
                ` : ''}
                <div class="ville-form">
                    <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                    <button onclick="rechercherVille()">OK</button>
                </div>
                <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
            </div>
        ` : `
            <p>Météo non disponible.</p>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
        `;

    } else if (type === 'priere') {
        document.getElementById('modal-body').innerHTML = priere ? `
            <div class="priere-modal">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    ${priere.titre ? `<div class="priere-titre-jour" style="margin-bottom:0;">📖 ${priere.titre}</div>` : '<div></div>'}
                    <button onclick="lirePriereModal(event)" title="Écouter la prière" style="background:#f3f4f6; border:none; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.1);" id="btn-speaker-modal">
                        🔊
                    </button>
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
                    <div class="priere-texte-complet" style="margin-top:10px;max-height:200px">${priere.lecture1.replace(/\n/g, '<br>')}</div>
                </details>` : ''}
                ${priere.source === 'catholique.fr' ? `<div class="priere-source">Source : eglise.catholique.fr</div>` : ''}
            </div>
        ` : '<p>Chargement...</p>';

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
            const photoSrc = p.photo || '';
            const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase() || '👤';

            document.getElementById('modal-body').innerHTML = `
                <div style="text-align:center;margin-bottom:16px">
                    ${photoSrc
                        ? `<img id="profil-photo-preview" src="${photoSrc}" class="photo-circle" onclick="document.getElementById('photo-input').click()">`
                        : `<div class="initiales" onclick="document.getElementById('photo-input').click()">${initiales}</div>`
                    }
                    <input type="file" id="photo-input" accept="image/*" style="display:none" onchange="previewPhoto(event)">
                    <div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Cliquez sur la photo pour changer</div>
                </div>
                <div class="profil-form">
                    <input id="p-prenom" placeholder="Prénom" value="${p.prenom||''}">
                    <input id="p-nom" placeholder="Nom" value="${p.nom||''}">
                    <input id="p-naissance" type="date" value="${p.date_naissance ? p.date_naissance.split('T')[0] : ''}">
                    <input id="p-email" placeholder="Email" value="${p.email||''}">
                    <input id="p-tel" placeholder="Téléphone" value="${p.telephone||''}">
                    <input id="p-prof" placeholder="Profession" value="${p.profession||''}">
                    <textarea id="p-note" placeholder="Note personnelle..." rows="3">${p.note||''}</textarea>
                </div>
                <button class="save-btn" onclick="sauvegarderProfil()">💾 Sauvegarder le profil</button>
                <div id="profil-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>

                <hr class="separateur">
                <h4 style="color:#333;margin-bottom:12px">🔑 Changer mon mot de passe</h4>
                <div class="mdp-form">
                    <input type="password" id="mdp-ancien" placeholder="Ancien mot de passe">
                    <input type="password" id="mdp-nouveau" placeholder="Nouveau mot de passe">
                    <input type="password" id="mdp-confirm" placeholder="Confirmer le nouveau mot de passe">
                </div>
                <button class="danger-btn" onclick="changerMdp()">🔑 Changer le mot de passe</button>
                <div id="mdp-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>

                <hr class="separateur">
                <h4 style="color:#333;margin-bottom:4px">📱 Mes widgets</h4>
                <p style="font-size:12px;color:#9ca3af;margin-bottom:12px">Choisis les widgets affichés sur ton tableau de bord.</p>
                <div id="widgets-choix" class="widgets-choix-grid">
                    <p style="color:#9ca3af;font-size:13px">Chargement...</p>
                </div>
                <button class="save-btn" style="margin-top:10px" onclick="sauvegarderWidgetsVisibles()">💾 Sauvegarder mes widgets</button>
                <div id="widgets-msg" style="text-align:center;margin-top:8px;font-size:13px;min-height:18px"></div>
            `;

            await afficherSectionWidgets();

        } catch {
            document.getElementById('modal-body').innerHTML = '<p>❌ Erreur de chargement du profil.</p>';
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
                    <input type="password" id="new-password" placeholder="Mot de passe (6 caractères min)">
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

function afficherDetailJour(i) {
    const d = meteoData;
    if (!d?.daily) return;
    const t    = d.daily.time[i];
    const date = new Date(t + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
    const iMax   = Math.round(d.daily.temperature_2m_max[i]);
    const iMin   = Math.round(d.daily.temperature_2m_min[i]);
    const iIcon  = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
    const iPluie = d.daily.precipitation_probability_max?.[i] || 0;
    const desc   = codes[d.daily.weather_code[i]] || 'Variable';

    document.querySelectorAll('.meteo-jour').forEach((el, idx) => {
        el.classList.toggle('meteo-jour-selected', idx === i);
    });

    document.getElementById('meteo-detail-jour').innerHTML = `
        <div class="meteo-detail-jour">
            <div class="meteo-detail-jour-top">
                <div>
                    <div class="meteo-detail-jour-date">${date}</div>
                    <div class="meteo-detail-jour-desc">${iIcon} ${desc}</div>
                    <div class="meteo-detail-jour-temp">↑ ${iMax}°  ↓ ${iMin}°</div>
                </div>
                <div style="font-size:48px;line-height:1">${iIcon}</div>
            </div>
            <div class="meteo-badges" style="margin-top:8px">
                <span class="meteo-badge">🌧️ Précipitations : ${iPluie}%</span>
            </div>
        </div>
    `;
}

// ── Lecture audio de la prière — voix masculine française ──
function lirePriereModal(e) {
    if (!('speechSynthesis' in window)) {
        alert("La synthèse vocale n'est pas supportée par votre navigateur.");
        return;
    }

    const synth = window.speechSynthesis;

    if (synth.speaking) {
        synth.cancel();
        if (e && e.currentTarget) e.currentTarget.textContent = '🔊';
        return;
    }

    const texteALire = `${priere.titre || ''}. ${priere.evangile || priere.texte || ''} ${priere.ref || ''}`;
    const utterance = new SpeechSynthesisUtterance(texteALire);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = 0.7; // Plus grave = plus masculin

    // Cherche une voix masculine française
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

        if (e && e.currentTarget) {
            e.currentTarget.textContent = '⏹️';
            utterance.onend  = () => { e.currentTarget.textContent = '🔊'; };
            utterance.onerror = () => { e.currentTarget.textContent = '🔊'; };
        }

        synth.speak(utterance);
    };

    // Les voix sont parfois chargées en asynchrone (surtout Chrome)
    if (synth.getVoices().length === 0) {
        synth.onvoiceschanged = lancerLecture;
    } else {
        lancerLecture();
    }
}

function closeModal() { document.getElementById('overlay').classList.remove('on'); }
function closeOutside(e) { if(e.target===document.getElementById('overlay')) closeModal(); }
