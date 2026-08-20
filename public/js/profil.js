// ============================================================
// public/js/profil.js — v3.56
// Profil utilisateur : affichage, édition, photo (cropper),
// suppression photo, trigramme 3 lettres, changement de mot
// de passe, préférences widgets (opt-out).
// Dépend de : app.js (getUser, profilCache, cropperInstance, TOUS_WIDGETS)
//             widgets.js (appliquerWidgetsVisibles)
// ============================================================

// ===================== UTILITAIRE TRIGRAMME ==================
function construireTrigramme(prenom, nom) {
    const mots = [...(prenom || '').split(/\s+/), ...(nom || '').split(/\s+/)]
        .map(m => m.trim())
        .filter(Boolean);
    return mots.slice(0, 3).map(m => m[0].toUpperCase()).join('');
}

// ===================== PROFIL HEADER =========================
async function chargerProfilHeader() {
    const user = getUser();
    if (!user?.token) return;
    const btn = document.getElementById('btn-profil-header');
    if (!btn) return;
    try {
        const r = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success || !d.profil) return;
        profilCache     = d.profil;
        const p         = d.profil;
        const trigramme = construireTrigramme(p.prenom, p.nom);

        if (p.photo) {
            btn.innerHTML          = `<img src="${p.photo}" alt="profil">`;
            btn.style.fontSize     = '';
            btn.style.fontWeight   = '';
            btn.style.background   = '';
        } else if (trigramme) {
            btn.innerHTML          = trigramme;
            btn.style.fontSize     = '11px';
            btn.style.fontWeight   = '700';
            btn.style.background   = '#7c3aed';
            btn.style.color        = '#fff';
        } else {
            btn.innerHTML          = '👤';
            btn.style.fontSize     = '';
            btn.style.fontWeight   = '';
        }

        const wc = document.getElementById('wc-profil');
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';
        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return `${a} ans`;
        })() : '';

        wc.innerHTML = `
            <div class="profil-widget">
                ${p.photo
                    ? `<img src="${p.photo}" alt="profil" class="profil-widget-photo">`
                    : `<div class="profil-widget-initiales">${trigramme || '👤'}</div>`
                }
                <div class="profil-widget-nom">${nom}</div>
                ${age          ? `<div class="profil-widget-info">${age}</div>`             : ''}
                ${p.profession ? `<div class="profil-widget-info">💼 ${p.profession}</div>` : ''}
                ${p.telephone  ? `<div class="profil-widget-info">📞 ${p.telephone}</div>`  : ''}
                ${p.note       ? `<div class="profil-widget-bio">${p.note}</div>`           : ''}
                <button class="profil-widget-btn" onclick="openModal('profil')">✏️ Modifier</button>
            </div>
        `;
    } catch { /* silencieux */ }
}

// ===================== PHOTO & CROPPER =======================

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
                    <button class="btn-crop-ok"     onclick="validerCrop()">✅ Valider le recadrage</button>
                </div>
            `;
            const tabInfos = document.getElementById('profil-tab-infos');
            if (tabInfos) tabInfos.insertBefore(cropZone, tabInfos.firstChild);
        }
        document.getElementById('crop-img').src = e.target.result;
        cropperInstance = new Cropper(document.getElementById('crop-img'), {
            aspectRatio: 1, viewMode: 1,
            movable: true, zoomable: true,
            rotatable: false, scalable: false
        });
    };
    reader.readAsDataURL(file);
}

function validerCrop() {
    if (!cropperInstance) return;
    const canvas  = cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Met à jour le preview dans la modale
    let preview = document.getElementById('profil-photo-preview');
    if (preview) {
        preview.src = dataUrl;
    } else {
        // Remplace initiales par une img
        const zone = document.querySelector('#profil-tab-infos .profil-widget-initiales, #profil-tab-infos .initiales');
        if (zone) {
            const newImg     = document.createElement('img');
            newImg.id        = 'profil-photo-preview';
            newImg.src       = dataUrl;
            newImg.style.cssText = 'width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #4f46e5;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
            newImg.onclick   = () => document.getElementById('photo-input').click();
            zone.replaceWith(newImg);
            preview = newImg;
        }
    }

    // Affiche le bouton "Supprimer" si pas encore présent
    let btnSuppr = document.getElementById('btn-supprimer-photo');
    if (!btnSuppr && preview) {
        btnSuppr = document.createElement('button');
        btnSuppr.id          = 'btn-supprimer-photo';
        btnSuppr.onclick     = supprimerPhoto;
        btnSuppr.style.cssText = 'margin-top:8px;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer';
        btnSuppr.innerHTML   = '🗑️ Supprimer la photo';
        preview.insertAdjacentElement('afterend', btnSuppr);
    }

    // Met à jour la navbar immédiatement sans attendre la sauvegarde
    const btn = document.getElementById('btn-profil-header');
    if (btn) {
        btn.innerHTML      = `<img src="${dataUrl}" alt="profil">`;
        btn.style.fontSize = '';
        btn.style.fontWeight = '';
        btn.style.background = '';
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

// ===================== SUPPRESSION PHOTO =====================

async function supprimerPhoto() {
    const user = getUser();
    const msg  = document.getElementById('profil-msg');
    if (!confirm('Supprimer la photo de profil ?')) return;
    try {
        const r = await fetch('/api/profil/photo', {
            method  : 'DELETE',
            headers : { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            profilCache       = { ...profilCache, photo: null };
            if (msg) {
                msg.textContent = '✅ Photo supprimée.';
                msg.style.color = '#10b981';
            }
            chargerProfilHeader();
            const preview   = document.getElementById('profil-photo-preview');
            const trigramme = construireTrigramme(profilCache?.prenom, profilCache?.nom);
            if (preview) {
                const div       = document.createElement('div');
                div.className   = 'profil-widget-initiales';
                div.style.cssText = 'width:90px;height:90px;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
                div.textContent = trigramme || '👤';
                div.onclick     = () => document.getElementById('photo-input').click();
                preview.replaceWith(div);
            }
            const btnSuppr = document.getElementById('btn-supprimer-photo');
            if (btnSuppr) btnSuppr.style.display = 'none';
        } else {
            if (msg) { msg.textContent = '❌ ' + (d.message || 'Erreur.'); msg.style.color = '#ef4444'; }
        }
    } catch {
        if (msg) { msg.textContent = '❌ Erreur réseau.'; msg.style.color = '#ef4444'; }
    }
}

// ===================== SAUVEGARDE PROFIL =====================

async function sauvegarderProfil() {
    const user = getUser();
    const msg  = document.getElementById('profil-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const photoEl = document.getElementById('profil-photo-preview');
    const photo   = photoEl?.src?.startsWith('data:') ? photoEl.src : (profilCache?.photo || null);

    const body = {
        prenom        : document.getElementById('p-prenom').value,
        nom           : document.getElementById('p-nom').value,
        date_naissance: document.getElementById('p-naissance').value || null,
        email         : document.getElementById('p-email').value,
        telephone     : document.getElementById('p-tel').value,
        profession    : document.getElementById('p-prof').value,
        note          : document.getElementById('p-note').value,
        photo
    };

    try {
        const r = await fetch('/api/profil', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Profil sauvegardé !';
            msg.style.color = '#10b981';
            profilCache     = { ...profilCache, ...body };
            chargerProfilHeader();
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

// ===================== MOT DE PASSE ==========================

function validerMotDePasse(pwd) {
    if (!pwd || pwd.length < 8)    return 'Minimum 8 caractères.';
    if (!/[A-Z]/.test(pwd))        return 'Au moins une majuscule requise.';
    if (!/[a-z]/.test(pwd))        return 'Au moins une minuscule requise.';
    if (!/[0-9]/.test(pwd))        return 'Au moins un chiffre requis.';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Au moins un caractère spécial requis.';
    return null;
}

async function changerMdp() {
    const user    = getUser();
    const ancien  = document.getElementById('mdp-ancien').value;
    const nouveau = document.getElementById('mdp-nouveau').value;
    const confirm = document.getElementById('mdp-confirm').value;
    const msg     = document.getElementById('mdp-msg');

    if (nouveau !== confirm) {
        msg.textContent = '❌ Les mots de passe ne correspondent pas.';
        msg.style.color = '#ef4444';
        return;
    }
    const erreur = validerMotDePasse(nouveau);
    if (erreur) {
        msg.textContent = '❌ ' + erreur;
        msg.style.color = '#ef4444';
        return;
    }
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';
    try {
        const r = await fetch('/api/profil/changer-mdp', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user.token}`
            },
            body: JSON.stringify({ ancienMdp: ancien, nouveauMdp: nouveau })
        });
        const d = await r.json();
        if (d.success) {
            msg.textContent = '✅ Mot de passe changé !';
            msg.style.color = '#10b981';
            document.getElementById('mdp-ancien').value  = '';
            document.getElementById('mdp-nouveau').value = '';
            document.getElementById('mdp-confirm').value = '';
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

// ===================== WIDGETS OPT-OUT =======================

async function afficherSectionWidgets() {
    const user      = getUser();
    const container = document.getElementById('widgets-choix');
    if (!container) return;
    try {
        const res  = await fetch('/api/profil/widgets-visibles', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const data          = await res.json();
        const widgetsCaches = data.widgets_caches || [];
        container.innerHTML = TOUS_WIDGETS.map(w => `
            <label class="widget-choix-item">
                <input type="checkbox" value="${w.slug}" ${widgetsCaches.includes(w.slug) ? '' : 'checked'}>
                <span>${w.label}</span>
            </label>
        `).join('');
    } catch {
        container.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>';
    }
}

async function sauvegarderWidgetsVisibles() {
    const user       = getUser();
    const msg        = document.getElementById('widgets-msg');
    const checkboxes = document.querySelectorAll('#widgets-choix input[type=checkbox]');

    const widgets_caches = [...checkboxes]
        .filter(cb => !cb.checked)
        .map(cb => cb.value);

    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';
    try {
        const res = await fetch('/api/profil/widgets-visibles', {
            method  : 'PATCH',
            headers : {
                'Authorization' : `Bearer ${user.token}`,
                'Content-Type'  : 'application/json'
            },
            body: JSON.stringify({ widgets_caches })
        });
        const d = await res.json();
        if (d.success) {
            msg.textContent = '✅ Widgets mis à jour !';
            msg.style.color = '#10b981';
            appliquerWidgetsVisibles(widgets_caches);
        } else {
            msg.textContent = '❌ Erreur serveur.';
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}
