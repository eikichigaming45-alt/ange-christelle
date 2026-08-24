// ============================================================
// public/js/profil.js
// Profil utilisateur : affichage, édition, photo (cropper),
// suppression photo, trigramme 3 lettres, changement de mot
// de passe, préférences widgets (opt-out).
// Onglet Santé : sexe, taille, poids, groupe sanguin,
// niveau d'activité, signe zodiaque, IMC, TDEE.
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

// ===================== CALCULS SANTÉ =========================

// IMC : poids (kg) / taille (m)²
function calculerIMC(poids, taille) {
    if (!poids || !taille) return null;
    return (poids / Math.pow(taille / 100, 2)).toFixed(1);
}

// Interprétation IMC
function interpreterIMC(imc) {
    if (!imc) return null;
    const v = parseFloat(imc);
    if (v < 18.5) return { label: 'Insuffisance pondérale', color: '#3b82f6' };
    if (v < 25)   return { label: 'Poids normal',           color: '#10b981' };
    if (v < 30)   return { label: 'Surpoids',               color: '#f59e0b' };
    return             { label: 'Obésité',                  color: '#ef4444' };
}

// TDEE Harris-Benedict révisé (Mifflin-St Jeor)
// Nécessite : poids (kg), taille (cm), age (ans), sexe, niveau_activite
function calculerTDEE(poids, taille, age, sexe, niveau_activite) {
    if (!poids || !taille || !age || !sexe) return null;
    let MB;
    if (sexe === 'homme') {
        MB = 10 * poids + 6.25 * taille - 5 * age + 5;
    } else {
        // femme + intersexe → formule femme par défaut
        MB = 10 * poids + 6.25 * taille - 5 * age - 161;
    }
    const facteurs = {
        'sedentaire'          : 1.2,
        'legèrement actif'    : 1.375,
        'modérément actif'    : 1.55,
        'très actif'          : 1.725
    };
    const facteur = facteurs[niveau_activite] || 1.2;
    return Math.round(MB * facteur);
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

        // Masquer/afficher widget cycle selon sexe
        _appliquerVisibiliteCycle(p.sexe);

        const wc = document.getElementById('wc-profil');
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';

        // Calcul de l'âge
        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return a;
        })() : null;

        // Calcul IMC pour le widget
        const imc      = calculerIMC(p.poids, p.taille);
        const imcInfos = interpreterIMC(imc);

        wc.innerHTML = `
            <div class="profil-widget">
                ${p.photo
                    ? `<img src="${p.photo}" alt="profil" class="profil-widget-photo">`
                    : `<div class="profil-widget-initiales">${trigramme || '👤'}</div>`
                }
                <div class="profil-widget-nom">${nom}</div>
                ${age          ? `<div class="profil-widget-info">${age} ans</div>`          : ''}
                ${p.profession ? `<div class="profil-widget-info">💼 ${p.profession}</div>` : ''}
                ${p.telephone  ? `<div class="profil-widget-info">📞 ${p.telephone}</div>`  : ''}
                ${imc && imcInfos ? `
                    <div class="profil-widget-info" style="color:${imcInfos.color};font-weight:600">
                        IMC ${imc} — ${imcInfos.label}
                    </div>` : ''}
                ${p.note       ? `<div class="profil-widget-bio">${p.note}</div>`           : ''}
            </div>
        `;
    } catch { /* silencieux */ }
}

// ── Masquer widget cycle si homme ou intersexe ────────────────
function _appliquerVisibiliteCycle(sexe) {
    const widgetCycle = document.querySelector('.widget[data-id="cycle"]');
    if (!widgetCycle) return;
    const cacher = sexe === 'homme' || sexe === 'intersexe';
    widgetCycle.style.display = cacher ? 'none' : '';
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

    let preview = document.getElementById('profil-photo-preview');
    if (preview) {
        preview.src = dataUrl;
    } else {
        const zone = document.querySelector('#profil-tab-infos .profil-widget-initiales, #profil-tab-infos .initiales');
        if (zone) {
            const newImg         = document.createElement('img');
            newImg.id            = 'profil-photo-preview';
            newImg.src           = dataUrl;
            newImg.style.cssText = 'width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #4f46e5;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
            newImg.onclick       = () => document.getElementById('photo-input').click();
            zone.replaceWith(newImg);
            preview = newImg;
        }
    }

    let btnSuppr = document.getElementById('btn-supprimer-photo');
    if (!btnSuppr && preview) {
        btnSuppr               = document.createElement('button');
        btnSuppr.id            = 'btn-supprimer-photo';
        btnSuppr.onclick       = supprimerPhoto;
        btnSuppr.style.cssText = 'margin-top:8px;background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer';
        btnSuppr.innerHTML     = '🗑️ Supprimer la photo';
        preview.insertAdjacentElement('afterend', btnSuppr);
    }

    const btn = document.getElementById('btn-profil-header');
    if (btn) {
        btn.innerHTML        = `<img src="${dataUrl}" alt="profil">`;
        btn.style.fontSize   = '';
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

function supprimerPhoto() {
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
        <div class="modal-actions">
            <button class="btn-delete" id="btn-photo-oui">Confirmer</button>
            <button class="btn-cancel" id="btn-photo-non">Annuler</button>
        </div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-photo-oui').onclick = () => _confirmerSupprimerPhoto();
    document.getElementById('btn-photo-non').onclick = () => openModal('profil');
}

async function _confirmerSupprimerPhoto() {
    const user = getUser();
    try {
        const r = await fetch('/api/profil/photo', {
            method  : 'DELETE',
            headers : { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            profilCache = { ...profilCache, photo: null };
            closeModal();
            chargerProfilHeader();
            const preview   = document.getElementById('profil-photo-preview');
            const trigramme = construireTrigramme(profilCache?.prenom, profilCache?.nom);
            if (preview) {
                const div         = document.createElement('div');
                div.className     = 'profil-widget-initiales';
                div.style.cssText = 'width:90px;height:90px;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.3)';
                div.textContent   = trigramme || '👤';
                div.onclick       = () => document.getElementById('photo-input').click();
                preview.replaceWith(div);
            }
            const btnSuppr = document.getElementById('btn-supprimer-photo');
            if (btnSuppr) btnSuppr.style.display = 'none';
        } else {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">
                    ${d.message || 'Erreur lors de la suppression.'}
                </p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>`;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Fermer</button>
            </div>`;
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
        // Onglet Profil
        prenom          : document.getElementById('p-prenom')?.value        || '',
        nom             : document.getElementById('p-nom')?.value           || '',
        date_naissance  : document.getElementById('p-naissance')?.value     || null,
        heure_naissance : document.getElementById('p-heure-naissance')?.value || null,
        lieu_naissance  : document.getElementById('p-lieu-naissance')?.value  || null,
        email           : document.getElementById('p-email')?.value         || '',
        telephone       : document.getElementById('p-tel')?.value           || '',
        profession      : document.getElementById('p-prof')?.value          || '',
        note            : document.getElementById('p-note')?.value          || '',
        photo,
        // Onglet Santé
        sexe            : document.getElementById('p-sexe')?.value          || null,
        taille          : document.getElementById('p-taille')?.value        ? parseInt(document.getElementById('p-taille').value) : null,
        poids           : document.getElementById('p-poids')?.value         ? parseFloat(document.getElementById('p-poids').value) : null,
        groupe_sanguin  : document.getElementById('p-groupe-sanguin')?.value || null,
        niveau_activite : document.getElementById('p-niveau-activite')?.value || null,
        signe_zodiaque  : document.getElementById('p-signe')?.value         || null,
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
            _appliquerVisibiliteCycle(body.sexe);
            // Rafraîchir les calculs IMC/TDEE affichés dans l'onglet Santé
            _rafraichirCalculsSante(body);
        } else {
            msg.textContent = '❌ ' + (d.message || 'Erreur.');
            msg.style.color = '#ef4444';
        }
    } catch {
        msg.textContent = '❌ Erreur réseau.';
        msg.style.color = '#ef4444';
    }
}

// ── Rafraîchit les blocs IMC/TDEE après sauvegarde ───────────
function _rafraichirCalculsSante(p) {
    const age = p.date_naissance ? (() => {
        const n     = new Date(p.date_naissance);
        const today = new Date();
        let a       = today.getFullYear() - n.getFullYear();
        if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
        return a;
    })() : null;

    const imc      = calculerIMC(p.poids, p.taille);
    const imcInfos = interpreterIMC(imc);
    const tdee     = calculerTDEE(p.poids, p.taille, age, p.sexe, p.niveau_activite);

    const elIMC  = document.getElementById('sante-imc-result');
    const elTDEE = document.getElementById('sante-tdee-result');

    if (elIMC) {
        elIMC.innerHTML = imc && imcInfos
            ? `<span style="font-size:22px;font-weight:700;color:${imcInfos.color}">${imc}</span>
               <span style="font-size:12px;color:${imcInfos.color};margin-left:6px">${imcInfos.label}</span>`
            : '<span style="color:#9ca3af;font-size:13px">Renseigne taille et poids</span>';
    }
    if (elTDEE) {
        elTDEE.innerHTML = tdee
            ? `<span style="font-size:22px;font-weight:700;color:#7c3aed">${tdee}</span>
               <span style="font-size:12px;color:#9ca3af;margin-left:6px">kcal / jour</span>`
            : '<span style="color:#9ca3af;font-size:13px">Renseigne taille, poids, âge et sexe</span>';
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

        const tries = [...TOUS_WIDGETS].sort((a, b) =>
            a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
        );

        container.innerHTML = tries.map(w => `
            <label class="widget-choix-item">
                <input type="checkbox" value="${w.slug}"
                    ${widgetsCaches.includes(w.slug) ? '' : 'checked'}>
                <span>${w.icon} ${w.label}</span>
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
