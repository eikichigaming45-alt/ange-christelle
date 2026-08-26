// ============================================================
// public/js/profil.js
// Profil utilisateur : affichage, édition, photo (cropper),
// suppression photo, trigramme 3 lettres, changement de mot
// de passe, préférences widgets (opt-out).
// Onglet Santé  : sexe, taille, poids, groupe sanguin,
//                 niveau activité, objectif santé, signe zodiaque,
//                 IMC, TDEE, kcal objectif.
// Géocodage Nominatim : lieu de naissance → lat/lon (onblur).
// Widget Mon Profil : signe astrologique à la place de l'IMC.
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

function calculerIMC(poids, taille) {
    if (!poids || !taille) return null;
    return (poids / Math.pow(taille / 100, 2)).toFixed(1);
}

function interpreterIMC(imc) {
    if (!imc) return null;
    const v = parseFloat(imc);
    if (v < 18.5) return { label: 'Insuffisance pondérale', color: '#3b82f6' };
    if (v < 25)   return { label: 'Poids normal',           color: '#10b981' };
    if (v < 30)   return { label: 'Surpoids',               color: '#f59e0b' };
    return             { label: 'Obésité',                  color: '#ef4444' };
}

function calculerTDEE(poids, taille, age, sexe, niveau_activite) {
    if (!poids || !taille || !age || !sexe) return null;
    let MB;
    if (sexe === 'homme') {
        MB = 10 * poids + 6.25 * taille - 5 * age + 5;
    } else {
        MB = 10 * poids + 6.25 * taille - 5 * age - 161;
    }
    const facteurs = {
        'sedentaire'        : 1.2,
        'légèrement actif'  : 1.375,
        'modérément actif'  : 1.55,
        'très actif'        : 1.725
    };
    const facteur = facteurs[niveau_activite] || 1.2;
    return Math.round(MB * facteur);
}

// ── Calcule les kcal cibles selon l'objectif ─────────────────
function calculerKcalObjectif(tdee, objectif) {
    if (!tdee || !objectif) return null;
    const delta = {
        perte_douce   : { val: -250, label: 'Perte douce',    color: '#3b82f6' },
        perte_moderee : { val: -500, label: 'Perte modérée',  color: '#f59e0b' },
        perte_rapide  : { val: -750, label: 'Perte rapide',   color: '#ef4444' },
        maintien      : { val:    0, label: 'Maintien',       color: '#10b981' },
        prise_douce   : { val: +250, label: 'Prise douce',    color: '#8b5cf6' },
        prise_moderee : { val: +500, label: 'Prise modérée',  color: '#7c3aed' },
    };
    const d = delta[objectif];
    if (!d) return null;
    return { valeur: tdee + d.val, label: d.label, color: d.color };
}

// ===================== SIGNE ASTROLOGIQUE ====================
// Calculé depuis la date de naissance, ou pris depuis signe_zodiaque
// si renseigné manuellement.

const _SIGNES_ZODIAQUE = [
    { signe:'Capricorne', emoji:'♑', mois:1,  jour:20 },
    { signe:'Verseau',    emoji:'♒', mois:2,  jour:19 },
    { signe:'Poissons',   emoji:'♓', mois:3,  jour:20 },
    { signe:'Bélier',     emoji:'♈', mois:4,  jour:20 },
    { signe:'Taureau',    emoji:'♉', mois:5,  jour:21 },
    { signe:'Gémeaux',    emoji:'♊', mois:6,  jour:21 },
    { signe:'Cancer',     emoji:'♋', mois:7,  jour:23 },
    { signe:'Lion',       emoji:'♌', mois:8,  jour:23 },
    { signe:'Vierge',     emoji:'♍', mois:9,  jour:23 },
    { signe:'Balance',    emoji:'♎', mois:10, jour:23 },
    { signe:'Scorpion',   emoji:'♏', mois:11, jour:22 },
    { signe:'Sagittaire', emoji:'♐', mois:12, jour:22 },
    { signe:'Capricorne', emoji:'♑', mois:12, jour:31 },
];

const _SIGNES_LABELS = {
    belier    : { signe:'Bélier',     emoji:'♈' },
    taureau   : { signe:'Taureau',    emoji:'♉' },
    gemeaux   : { signe:'Gémeaux',    emoji:'♊' },
    cancer    : { signe:'Cancer',     emoji:'♋' },
    lion      : { signe:'Lion',       emoji:'♌' },
    vierge    : { signe:'Vierge',     emoji:'♍' },
    balance   : { signe:'Balance',    emoji:'♎' },
    scorpion  : { signe:'Scorpion',   emoji:'♏' },
    sagittaire: { signe:'Sagittaire', emoji:'♐' },
    capricorne: { signe:'Capricorne', emoji:'♑' },
    verseau   : { signe:'Verseau',    emoji:'♒' },
    poissons  : { signe:'Poissons',   emoji:'♓' },
};

function _signeDepuisDate(dateStr) {
    if (!dateStr) return null;
    const d    = new Date(dateStr);
    const mois = d.getMonth() + 1;
    const jour = d.getDate();
    const found = _SIGNES_ZODIAQUE.find(s => mois < s.mois || (mois === s.mois && jour <= s.jour));
    return found || null;
}

function obtenirSigne(p) {
    // Priorité : signe manuel → calcul depuis date de naissance
    if (p.signe_zodiaque && _SIGNES_LABELS[p.signe_zodiaque]) {
        return _SIGNES_LABELS[p.signe_zodiaque];
    }
    return _signeDepuisDate(p.date_naissance);
}

// ===================== GÉOCODAGE NOMINATIM ===================

async function geocoderLieuNaissance() {
    const input  = document.getElementById('p-lieu-naissance');
    const msg    = document.getElementById('p-lieu-naissance-msg');
    const latEl  = document.getElementById('p-naissance-lat');
    const lonEl  = document.getElementById('p-naissance-lon');
    if (!input || !msg || !latEl || !lonEl) return;

    const q = input.value.trim();
    if (!q) {
        msg.textContent = '';
        latEl.value     = '';
        lonEl.value     = '';
        return;
    }

    msg.textContent = '🔍 Recherche en cours...';
    msg.style.color = '#9ca3af';

    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await r.json();
        if (!data.length) {
            msg.textContent = '❌ Lieu non trouvé — vérifie le nom de la ville.';
            msg.style.color = '#ef4444';
            latEl.value     = '';
            lonEl.value     = '';
            return;
        }
        const lieu      = data[0];
        latEl.value     = lieu.lat;
        lonEl.value     = lieu.lon;
        msg.textContent = `✅ ${lieu.display_name.split(',').slice(0, 2).join(',')}`;
        msg.style.color = '#10b981';
    } catch {
        msg.textContent = '❌ Erreur réseau lors du géocodage.';
        msg.style.color = '#ef4444';
        latEl.value     = '';
        lonEl.value     = '';
    }
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

        // Mise en cache localStorage pour pré-injection au prochain refresh
        try {
            localStorage.setItem('myvibe_profil', JSON.stringify({ photo: p.photo || null }));
        } catch { /* silencieux */ }

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

        _appliquerVisibiliteCycle(p.sexe);

        const wc = document.getElementById('wc-profil');
        if (!wc) return;
        const nom = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Mon Profil';

        const age = p.date_naissance ? (() => {
            const n     = new Date(p.date_naissance);
            const today = new Date();
            let a       = today.getFullYear() - n.getFullYear();
            if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
            return a;
        })() : null;

        const signe = obtenirSigne(p);

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
                ${signe        ? `<div class="profil-widget-info">${signe.emoji} ${signe.signe}</div>` : ''}
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
            // Purge du cache localStorage photo
            try {
                localStorage.setItem('myvibe_profil', JSON.stringify({ photo: null }));
            } catch { /* silencieux */ }
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
        prenom          : document.getElementById('p-prenom')?.value           || '',
        nom             : document.getElementById('p-nom')?.value              || '',
        date_naissance  : document.getElementById('p-naissance')?.value        || null,
        heure_naissance : document.getElementById('p-heure-naissance')?.value  || null,
        lieu_naissance  : document.getElementById('p-lieu-naissance')?.value   || null,
        naissance_lat   : document.getElementById('p-naissance-lat')?.value    ? parseFloat(document.getElementById('p-naissance-lat').value)  : null,
        naissance_lon   : document.getElementById('p-naissance-lon')?.value    ? parseFloat(document.getElementById('p-naissance-lon').value)  : null,
        email           : document.getElementById('p-email')?.value            || '',
        telephone       : document.getElementById('p-tel')?.value              || '',
        profession      : document.getElementById('p-prof')?.value             || '',
        note            : document.getElementById('p-note')?.value             || '',
        photo,
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

// ===================== SAUVEGARDE SANTÉ ======================
// Fonction dédiée à l'onglet Santé — id feedback : sante-msg
// pour éviter le conflit avec profil-msg de l'onglet Profil.

async function sauvegarderSante() {
    const user = getUser();
    const msg  = document.getElementById('sante-msg');
    msg.textContent = 'Sauvegarde...';
    msg.style.color = '#9ca3af';

    const body = {
        sexe            : document.getElementById('p-sexe')?.value             || null,
        taille          : document.getElementById('p-taille')?.value           ? parseInt(document.getElementById('p-taille').value)           : null,
        poids           : document.getElementById('p-poids')?.value            ? parseFloat(document.getElementById('p-poids').value)           : null,
        groupe_sanguin  : document.getElementById('p-groupe-sanguin')?.value   || null,
        niveau_activite : document.getElementById('p-niveau-activite')?.value  || null,
        objectif_sante  : document.getElementById('p-objectif-sante')?.value  || null,
        signe_zodiaque  : document.getElementById('p-signe')?.value            || null,
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
            msg.textContent = '✅ Santé sauvegardée !';
            msg.style.color = '#10b981';
            profilCache     = { ...profilCache, ...body };
            _appliquerVisibiliteCycle(body.sexe);
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

// ── Rafraîchit IMC, TDEE et kcal objectif après sauvegarde ───
function _rafraichirCalculsSante(p) {
    const age = p.date_naissance ? (() => {
        const n     = new Date(p.date_naissance);
        const today = new Date();
        let a       = today.getFullYear() - n.getFullYear();
        if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
        return a;
    })() : (profilCache?.date_naissance ? (() => {
        const n     = new Date(profilCache.date_naissance);
        const today = new Date();
        let a       = today.getFullYear() - n.getFullYear();
        if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
        return a;
    })() : null);

    const imc      = calculerIMC(p.poids, p.taille);
    const imcInfos = interpreterIMC(imc);
    const tdee     = calculerTDEE(p.poids, p.taille, age, p.sexe, p.niveau_activite);
    const kcalObj  = calculerKcalObjectif(tdee, p.objectif_sante);

    const elIMC     = document.getElementById('sante-imc-result');
    const elTDEE    = document.getElementById('sante-tdee-result');
    const elKcalObj = document.getElementById('sante-kcalobj-result');

    if (elIMC) {
        elIMC.innerHTML = imc && imcInfos
            ? `<span style="font-size:22px;font-weight:700;color:${imcInfos.color}">${imc}</span>
               <span style="font-size:12px;color:${imcInfos.color};display:block;margin-top:2px">${imcInfos.label}</span>`
            : '<span style="color:#9ca3af;font-size:13px">Renseigne taille et poids</span>';
    }
    if (elTDEE) {
        elTDEE.innerHTML = tdee
            ? `<span style="font-size:22px;font-weight:700;color:#7c3aed">${tdee}</span>
               <span style="font-size:12px;color:#9ca3af;display:block;margin-top:2px">kcal / jour (maintien)</span>`
            : '<span style="color:#9ca3af;font-size:13px">Renseigne taille, poids, âge et sexe</span>';
    }
    if (elKcalObj) {
        elKcalObj.innerHTML = kcalObj
            ? `<span style="font-size:22px;font-weight:700;color:${kcalObj.color}">${kcalObj.valeur}</span>
               <span style="font-size:12px;color:${kcalObj.color};display:block;margin-top:2px">${kcalObj.label}</span>`
            : '<span style="color:#9ca3af;font-size:13px">Renseigne un objectif et ton TDEE</span>';
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
