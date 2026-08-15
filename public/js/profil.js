// ===================== PROFIL & CROPPER =====================

async function chargerProfilHeader() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId) return;
    try {
        const r = await fetch(`/api/profil?userId=${user.userId}`);
        const d = await r.json();
        if (d.success && d.profil) {
            profilCache = d.profil;
            const p = d.profil;
            const initiales = ((p.prenom?.[0]||'')+(p.nom?.[0]||'')).toUpperCase()||'';
            const btnHeader = document.getElementById('btn-profil-header');
            if (p.photo) { btnHeader.innerHTML = `<img src="${p.photo}" alt="profil">`; }
            else if (initiales) { btnHeader.innerHTML = initiales; btnHeader.style.fontSize='13px'; btnHeader.style.fontWeight='700'; }
            else { btnHeader.innerHTML = '👤'; }
            const wi = document.getElementById('wi-profil');
            if (wi) wi.innerHTML = p.photo ? `<img src="${p.photo}" alt="profil">` : '👤';
            const wc = document.getElementById('wc-profil');
            if (wc) wc.textContent = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Cliquez pour modifier votre profil';
        }
    } catch(e) {}
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
            saveBtn.parentNode.insertBefore(cropZone, saveBtn);
        }
        const cropImg = document.getElementById('crop-img');
        cropImg.src = e.target.result;
        cropperInstance = new Cropper(cropImg, {
            aspectRatio: 1,
            viewMode: 1,
            movable: true,
            zoomable: true,
            rotatable: false,
            scalable: false,
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
    msg.textContent='Sauvegarde...'; msg.style.color='#9ca3af';
    const photoEl = document.getElementById('profil-photo-preview');
    const photo = photoEl?.src?.startsWith('data:') ? photoEl.src : (profilCache?.photo||null);
    const body = {
        userId:user.userId,
        prenom:document.getElementById('p-prenom').value,
        nom:document.getElementById('p-nom').value,
        date_naissance:document.getElementById('p-naissance').value||null,
        email:document.getElementById('p-email').value,
        telephone:document.getElementById('p-tel').value,
        profession:document.getElementById('p-prof').value,
        note:document.getElementById('p-note').value,
        photo
    };
    try {
        const r = await fetch('/api/profil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const d = await r.json();
        if (d.success) {
            msg.textContent='✅ Profil sauvegardé !'; msg.style.color='#10b981';
            profilCache={...profilCache,...body};
            chargerProfilHeader();
        } else { msg.textContent='❌ '+d.message; msg.style.color='#ef4444'; }
    } catch { msg.textContent='❌ Erreur réseau'; msg.style.color='#ef4444'; }
}

async function changerMdp() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const ancien=document.getElementById('mdp-ancien').value;
    const nouveau=document.getElementById('mdp-nouveau').value;
    const confirm=document.getElementById('mdp-confirm').value;
    const msg=document.getElementById('mdp-msg');
    if (nouveau!==confirm) { msg.textContent='❌ Les mots de passe ne correspondent pas'; msg.style.color='#ef4444'; return; }
    msg.textContent='Sauvegarde...'; msg.style.color='#9ca3af';
    try {
        const r = await fetch('/api/changer-mdp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:user.userId,ancienMdp:ancien,nouveauMdp:nouveau})});
        const d = await r.json();
        if (d.success) {
            msg.textContent='✅ Mot de passe changé !'; msg.style.color='#10b981';
            document.getElementById('mdp-ancien').value='';
            document.getElementById('mdp-nouveau').value='';
            document.getElementById('mdp-confirm').value='';
        } else { msg.textContent='❌ '+d.message; msg.style.color='#ef4444'; }
    } catch { msg.textContent='❌ Erreur réseau'; msg.style.color='#ef4444'; }
}
