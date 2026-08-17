// ===================== PROFIL & CROPPER =====================

async function chargerProfilHeader() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    try {
        const r = await fetch(`/api/profil?userId=${user.userId}`);
        const d = await r.json();
        if (!d.success || !d.profil) return;
        profilCache = d.profil;
        const p = d.profil;

        // Topbar
        const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase() || '';
        const btnHeader = document.getElementById('btn-profil-header');
        if (p.photo) { btnHeader.innerHTML = `<img src="${p.photo}" alt="profil">`; }
        else if (initiales) { btnHeader.innerHTML = initiales; btnHeader.style.fontSize='13px'; btnHeader.style.fontWeight='700'; }
        else { btnHeader.innerHTML = '👤'; }

        // Icône widget
        const wi = document.getElementById('wi-profil');
        if (wi) wi.innerHTML = p.photo ? `<img src="${p.photo}" alt="profil">` : '👤';

        // Contenu widget enrichi
        const wc = document.getElementById('wc-profil');
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';
        const age = p.date_naissance ? (() => {
            const n = new Date(p.date_naissance);
            const today = new Date();
            let a = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return `${a} ans`;
        })() : '';

        wc.innerHTML = `
            <div class="profil-widget">
                ${p.photo
                    ? `<img src="${p.photo}" alt="profil" class="profil-widget-photo">`
                    : `<div class="profil-widget-initiales">${initiales || '👤'}</div>`
                }
                <div class="profil-widget-nom">${nom}</div>
                ${age          ? `<div class="profil-widget-info">${age}</div>` : ''}
                ${p.profession ? `<div class="profil-widget-info">💼 ${p.profession}</div>` : ''}
                ${p.telephone  ? `<div class="profil-widget-info">📞 ${p.telephone}</div>` : ''}
                ${p.note       ? `<div class="profil-widget-bio">${p.note}</div>` : ''}
                <button class="profil-widget-btn" onclick="openModal('profil')">✏️ Modifier</button>
            </div>
        `;
    } catch(e) {}
}

function switchProfilTab(tab) {
    document.querySelectorAll('.profil-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profil-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.profil-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`profil-tab-${tab}`).classList.add('active');
}

function previewPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
        let cropZone = document.getElementById('crop-zone');
        if (!cropZone) {
            cropZone = document.createElement('div');
            cropZone.id = 'crop-zone';
            cropZone.innerHTML = `
                <div class="crop-container">
                    <img id="crop-img" src="">
                </div>
                <div class="crop-actions">
                    <button class="btn-crop-cancel" onclick="annulerCrop()">✕ Annuler</button>
                    <button class="btn-crop-ok" onclick="validerCrop()">✅ Valider le recadrage</button>
                </div>
            `;
            const saveBtn = document.querySelector('.save-btn');
            if (saveBtn) saveBtn.parentNode.insertBefore(cropZone, saveBtn);
            else document.getElementById('profil-tab-infos').appendChild(cropZone);
        }
        const cropImg = document.getElementById('crop-img');
        cropImg.src = e.target.result;
        cropperInstance = new Cropper(cropImg, {
            aspectRatio: 1, viewMode: 1,
            movable: true, zoomable: true,
            rotatable: false, scalable: false,
        });
    };
    reader.readAsDataURL(file);
}

function validerCrop() {
    if (!cropperInstance) return;
    const canvas = cropperInstance.getCroppedCanvas({ width:300, height:300 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    let preview = document.getElementById('profil-photo-preview');
    if (preview) {
        preview.src = dataUrl;
    } else {
        const zone = document.querySelector('.initiales');
        if (zone) {
            const newImg = document.createElement('img');
            newImg.id = 'profil-photo-preview';
            newImg.src = dataUrl;
            newImg.className = 'photo-circle';
            newImg.onclick = () => document.getElementById('photo-input').click();
            zone.replaceWith(newImg);
        }
    }
    annulerCrop();
}

function annulerCrop() {
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    const cropZone = document.getElementById('crop-zone');
    if (cropZone) cropZone.remove();
    const input = document.getElementById('photo-input');
    if (input) input.value = '';
}

async function sauvegarderProfil() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const msg = document.getElementById('profil-msg');
    msg.textContent = 'Sauvegarde...'; msg.style.color = '#9ca3af';
    const photoEl = document.getElementById('profil-photo-preview');
    const photo = photoEl?.src?.startsWith('data:') ? photoEl.src : (profilCache?.photo||null);
    const body = {
        userId: user.userId,
        prenom: document.getElementById('p-prenom').value,
        nom: document.getElementById('p-nom').value,
        date_naissance: document.getElementById('p-naissance').value || null,
        email: document.getElementById('p-email').value,
        telephone: document.getElementById('p-tel').value,
        profession: document.getElementById('p-prof').value,
        note: document.getElementById('p-note').value,
        photo
    };
    try {
        const r = await fetch('/api/profil', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Profil sauvegardé !'; msg.style.color = '#10b981';
            profilCache = { ...profilCache, ...body };
            chargerProfilHeader();
        } else {
            msg.textContent = '❌ ' + d.message; msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau'; msg.style.color = '#ef4444';
    }
}

async function changerMdp() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const ancien  = document.getElementById('mdp-ancien').value;
    const nouveau = document.getElementById('mdp-nouveau').value;
    const confirm = document.getElementById('mdp-confirm').value;
    const msg = document.getElementById('mdp-msg');
    if (nouveau !== confirm) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas';
        msg.style.color = '#ef4444'; return;
    }
    msg.textContent = 'Sauvegarde...'; msg.style.color = '#9ca3af';
    try {
        const r = await fetch('/api/profil/changer-mdp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Mot de passe changé !'; msg.style.color = '#10b981';
            document.getElementById('mdp-ancien').value = '';
            document.getElementById('mdp-nouveau').value = '';
            document.getElementById('mdp-confirm').value = '';
        } else {
            msg.textContent = '❌ ' + d.message; msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau'; msg.style.color = '#ef4444';
    }
}

// ===================== WIDGETS VISIBLES =====================

const TOUS_WIDGETS = [
    { slug: 'meteo',         label: '🌤️ Météo' },
    { slug: 'priere',        label: '🙏 Prière du jour' },
    { slug: 'planning',      label: '📋 Planning' },
    { slug: 'rendezvous',    label: '🩺 Rendez-vous' },
    { slug: 'cycle',         label: '🌸 Suivi du cycle' },
    { slug: 'taches',        label: '✅ Tâches' },
    { slug: 'anniversaires', label: '🎂 Anniversaires' },
];

async function afficherSectionWidgets() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const token = user?.token;
    const container = document.getElementById('widgets-choix');
    if (!container) return;
    try {
        const res = await fetch('/api/profil/widgets-visibles', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        const actifs = data.widgets_visibles || TOUS_WIDGETS.map(w => w.slug);
        container.innerHTML = TOUS_WIDGETS.map(w => `
            <label class="widget-choix-item">
                <input type="checkbox" value="${w.slug}" ${actifs.includes(w.slug) ? 'checked' : ''}>
                <span>${w.label}</span>
            </label>
        `).join('');
    } catch {
        container.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>';
    }
}

async function sauvegarderWidgetsVisibles() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const token = user?.token;
    const msg = document.getElementById('widgets-msg');
    const checkboxes = document.querySelectorAll('#widgets-choix input[type=checkbox]');
    const widgets_visibles = [...checkboxes].filter(cb => cb.checked).map(cb => cb.value);

    if (widgets_visibles.length === 0) {
        msg.textContent = '❌ Sélectionne au moins un widget.';
        msg.style.color = '#ef4444'; return;
    }

    msg.textContent = 'Sauvegarde...'; msg.style.color = '#9ca3af';

    try {
        const res = await fetch('/api/profil/widgets-visibles', {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ widgets_visibles })
        });
        if (res.ok) {
            msg.textContent = '✅ Widgets mis à jour !'; msg.style.color = '#10b981';
            appliquerWidgetsVisibles(widgets_visibles);
        } else {
            msg.textContent = '❌ Erreur serveur.'; msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.'; msg.style.color = '#ef4444';
    }
}
