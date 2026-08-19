// ============================================================================
// FICHIER : public/js/profil.js
// DESCRIPTION : Profil utilisateur, cropper photo, mot de passe, widgets (opt-out)
// ============================================================================

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
        const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase() || '';

        const btnHeader = document.getElementById('btn-profil-header');
        if (btnHeader) {
            if (p.photo) {
                btnHeader.innerHTML = `<img src="${p.photo}" alt="profil">`;
            } else if (initiales) {
                btnHeader.innerHTML = initiales;
                btnHeader.style.fontSize = '13px';
                btnHeader.style.fontWeight = '700';
            } else {
                btnHeader.innerHTML = '👤';
            }
        }

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

// ===================== MOT DE PASSE =====================

function validerMotDePasse(pwd) {
    if (!pwd || pwd.length < 8)     return 'Minimum 8 caractères.';
    if (!/[A-Z]/.test(pwd))         return 'Au moins une majuscule requise.';
    if (!/[a-z]/.test(pwd))         return 'Au moins une minuscule requise.';
    if (!/[0-9]/.test(pwd))         return 'Au moins un chiffre requis.';
    if (!/[^A-Za-z0-9]/.test(pwd))  return 'Au moins un caractère spécial requis (!@#$%...).';
    return null;
}

async function changerMdp() {
    const user    = JSON.parse(localStorage.getItem('myvibe_user'));
    const ancien  = document.getElementById('mdp-ancien').value;
    const nouveau = document.getElementById('mdp-nouveau').value;
    const confirm = document.getElementById('mdp-confirm').value;
    const msg     = document.getElementById('mdp-msg');

    if (nouveau !== confirm) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas';
        msg.style.color = '#ef4444'; return;
    }
    const erreur = validerMotDePasse(nouveau);
    if (erreur) {
        msg.textContent = '❌ ' + erreur;
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

// ===================== WIDGETS (opt-out) =====================
// TOUS_WIDGETS est défini dans app.js — ne pas redéclarer ici
// La liste widgets_caches contient uniquement les widgets décochés par l'utilisateur.
// Un widget absent de cette liste = visible par défaut (nouveaux widgets inclus).

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
        // widgets_caches = liste des slugs décochés. Vide = tout est visible.
        const caches = data.widgets_caches || [];
        container.innerHTML = TOUS_WIDGETS.map(w => `
            <label class="widget-choix-item">
                <input type="checkbox" value="${w.slug}" ${caches.includes(w.slug) ? '' : 'checked'}>
                <span>${w.label}</span>
            </label>
        `).join('');
    } catch {
        container.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>';
    }
}

async function sauvegarderWidgetsVisibles() {
    const user  = JSON.parse(localStorage.getItem('myvibe_user'));
    const token = user?.token;
    const msg   = document.getElementById('widgets-msg');
    const checkboxes = document.querySelectorAll('#widgets-choix input[type=checkbox]');

    // Opt-out : on envoie uniquement les widgets décochés
    const widgets_caches = [...checkboxes].filter(cb => !cb.checked).map(cb => cb.value);

    msg.textContent = 'Sauvegarde...'; msg.style.color = '#9ca3af';
    try {
        const res = await fetch('/api/profil/widgets-visibles', {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ widgets_caches })
        });
        if (res.ok) {
            msg.textContent = '✅ Widgets mis à jour !'; msg.style.color = '#10b981';
            appliquerWidgetsVisibles(widgets_caches);
        } else {
            msg.textContent = '❌ Erreur serveur.'; msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.'; msg.style.color = '#ef4444';
    }
}
