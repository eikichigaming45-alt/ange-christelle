// ===================== GESTION DES MODALES =====================

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
            <div class="meteo-detail">
                <strong>📍 ${d.ville}</strong><br>
                ${d.desc}<br>
                🌡️ Température : <strong>${d.temp}°C</strong> (min ${d.min}°C / max ${d.max}°C)<br>
                💨 Vent : ${d.vent} km/h<br>
                💧 Humidité : ${d.hum}%
            </div>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
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
            <p class="priere-txt">"${priere.texte}"</p>
            <span class="priere-ref">— ${priere.ref}</span>
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
        if (!user?.userId) { document.getElementById('modal-body').innerHTML = '<p>Erreur : utilisateur non identifié.</p>'; return; }
        try {
            const r = await fetch(`/api/profil?userId=${user.userId}`);
            const d = await r.json();
            const p = d.profil||{};
            profilCache = p;
            const photoSrc = p.photo||'';
            const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase()||'👤';
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
                    <input id="p-naissance" type="date" value="${p.date_naissance?p.date_naissance.split('T')[0]:''}">
                    <input id="p-email" placeholder="Email" value="${p.email||''}">
                    <input id="p-tel" placeholder="Téléphone" value="${p.telephone||''}">
                    <input id="p-prof" placeholder="Profession" value="${p.profession||''}">
                    <textarea id="p-note" placeholder="Note personnelle..." rows="3">${p.note||''}</textarea>
                </div>
                <button class="save-btn" onclick="sauvegarderProfil()">💾 Sauvegarder</button>
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
            `;
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

function closeModal() { document.getElementById('overlay').classList.remove('on'); }
function closeOutside(e) { if(e.target===document.getElementById('overlay')) closeModal(); }
