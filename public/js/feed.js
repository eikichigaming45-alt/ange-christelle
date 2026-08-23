// ── SUPPRIMER POST — modale custom ────────────────────────────
function supprimerPost(postId) {
    document.getElementById('modal-title').textContent = 'Confirmation';
    document.getElementById('modal-body').innerHTML = `
        <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
        <div style="display:flex;gap:8px">
            <button id="btn-delpost-oui" style="flex:1;padding:13px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Confirmer</button>
            <button id="btn-delpost-non" style="flex:1;padding:13px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">Annuler</button>
        </div>`;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('btn-delpost-non').onclick = () => {
        document.getElementById('overlay').classList.remove('on');
    };
    document.getElementById('btn-delpost-oui').onclick = async () => {
        const user = getUser();
        try {
            const r = await fetch(`/api/feed/${postId}`, {
                method : 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (d.success) {
                document.getElementById('overlay').classList.remove('on');
                document.getElementById(`post-${postId}`)?.remove();
            }
        } catch {}
    };
}

// ── FOLLOW ────────────────────────────────────────────────────
async function toggleFollow(userId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        if (d.following) {
            feedFollowing.push(userId);
            btn.textContent = 'Abonné';
            btn.classList.add('following');
        } else {
            feedFollowing = feedFollowing.filter(id => id !== userId);
            btn.textContent = 'Suivre';
            btn.classList.remove('following');
        }
    } catch {}
}

// ── MODAL NOUVEAU POST ────────────────────────────────────────
function ouvrirModalPost() {
    window._editSupprimerPhoto = false;
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = 'Nouveau post';
    document.getElementById('modal-body').innerHTML = `
        <textarea id="post-contenu" placeholder="Quoi de neuf ?" rows="4"
            style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;
                   font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit"></textarea>
        <div style="margin-top:12px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;display:block;margin-bottom:6px">Photo (optionnelle)</label>
            <input type="file" id="post-photo" accept="image/*" capture="environment"
                style="font-size:13px;color:#374151">
        </div>
        <div id="post-preview" style="margin-top:10px"></div>
        <button onclick="publierPost()"
            style="width:100%;margin-top:16px;padding:13px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                   color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer">
            Publier
        </button>
        <div id="post-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
    `;
    document.getElementById('post-photo').addEventListener('change', e => {
        const file    = e.target.files[0];
        const preview = document.getElementById('post-preview');
        if (file) {
            const url = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${url}" style="width:100%;border-radius:10px;max-height:200px;object-fit:cover">`;
        } else {
            preview.innerHTML = '';
        }
    });
}

async function publierPost() {
    const user    = getUser();
    const contenu = document.getElementById('post-contenu').value.trim();
    const photo   = document.getElementById('post-photo').files[0];
    const msg     = document.getElementById('post-msg');
    if (!contenu && !photo) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Le post ne peut pas être vide.';
        return;
    }
    try {
        let photoB64 = null;
        let mime     = null;
        if (photo) {
            mime     = photo.type || 'image/jpeg';
            photoB64 = await new Promise((resolve, reject) => {
                const reader   = new FileReader();
                reader.onload  = e => resolve(e.target.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(photo);
            });
        }
        const body = { contenu };
        if (photoB64) { body.photo = photoB64; body.mime = mime; }
        const r = await fetch('/api/feed', {
            method  : 'POST',
            headers : { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
            body    : JSON.stringify(body)
        });
        const d = await r.json();
        if (d.success) {
            closeModal();
            await chargerFeed();
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = d.message || 'Erreur.';
        }
    } catch {
        msg.style.color = '#ef4444';
        msg.textContent = 'Erreur réseau.';
    }
}

// ── PROFIL PUBLIC ─────────────────────────────────────────────
async function ouvrirProfilPublic(userId) {
    const user = getUser();
    try {
        const r = await fetch(`/api/profil/public/${userId}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        const p       = d.profil;
        const isSelf  = user.username === p.username;
        const avatar  = p.photo
            ? `<img src="${p.photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #7c3aed">`
            : `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-size:28px;font-weight:700;display:flex;align-items:center;justify-content:center">${(p.prenom?.[0] || p.username[0]).toUpperCase()}</div>`;

        document.getElementById('modal-title').textContent = '';
        document.getElementById('modal-body').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0">
                ${avatar}
                <div style="text-align:center">
                    <div style="font-size:18px;font-weight:700;color:#111">${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')}</div>
                    <div style="font-size:13px;color:#9ca3af;margin-top:2px">@${escapeHtml(p.username)}</div>
                    ${p.signe_zodiaque ? `<div style="font-size:12px;color:#7c3aed;margin-top:4px">${escapeHtml(p.signe_zodiaque)}</div>` : ''}
                </div>
                <div style="display:flex;gap:24px;text-align:center;background:#f9fafb;border-radius:14px;padding:14px 24px;width:100%;justify-content:center">
                    <div>
                        <div style="font-size:20px;font-weight:800;color:#111">${p.nb_posts}</div>
                        <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Posts</div>
                    </div>
                    <div>
                        <div style="font-size:20px;font-weight:800;color:#111">${p.nb_abonnes}</div>
                        <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Abonnés</div>
                    </div>
                    <div>
                        <div style="font-size:20px;font-weight:800;color:#111">${p.nb_abonnements}</div>
                        <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase">Abonnements</div>
                    </div>
                </div>
                ${!isSelf ? `
                <button id="btn-profil-follow"
                    onclick="toggleFollowDepuisProfil(${p.id}, this)"
                    style="width:100%;padding:12px;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;
                           background:${p.suivi ? '#f3f4f6' : 'linear-gradient(135deg,#7c3aed,#6d28d9)'};
                           color:${p.suivi ? '#374151' : '#fff'}">
                    ${p.suivi ? 'Abonné' : 'Suivre'}
                </button>` : ''}
            </div>
        `;
        document.getElementById('overlay').classList.add('on');
    } catch {}
}

async function toggleFollowDepuisProfil(userId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        if (d.following) {
            feedFollowing.push(userId);
            btn.textContent = 'Abonné';
            btn.style.background = '#f3f4f6';
            btn.style.color      = '#374151';
        } else {
            feedFollowing = feedFollowing.filter(id => id !== userId);
            btn.textContent = 'Suivre';
            btn.style.background = 'linear-gradient(135deg,#7c3aed,#6d28d9)';
            btn.style.color      = '#fff';
        }
        // Sync bouton follow dans le feed
        const feedBtn = document.querySelector(`.feed-follow-btn[onclick="toggleFollow(${userId}, this)"]`);
        if (feedBtn) {
            feedBtn.textContent = d.following ? 'Abonné' : 'Suivre';
            feedBtn.classList.toggle('following', d.following);
        }
    } catch {}
}

// ── PHOTO PLEIN ÉCRAN ─────────────────────────────────────────
function ouvrirPhoto(url) {
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = '';
    document.getElementById('modal-body').innerHTML = `
        <img src="${url}" style="width:100%;border-radius:10px;max-height:70vh;object-fit:contain">
    `;
}

// ── PARTAGE ───────────────────────────────────────────────────
async function partagerPost(postId) {
    const card      = document.getElementById(`post-${postId}`);
    const contenuEl = document.getElementById(`post-contenu-${postId}`);
    const contenu   = contenuEl ? contenuEl.textContent.trim() : '';
    const photoUrl  = card?.dataset.photoUrl || '';
    const text      = contenu.substring(0, 100) || 'Regarde ce post sur MyDaily';

    if (navigator.share) {
        try {
            const shareData = { title: 'MyDaily', text };
            shareData.url   = photoUrl || location.origin;
            await navigator.share(shareData);
        } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
        }
    } else {
        try {
            const urlACopier = photoUrl || location.origin;
            await navigator.clipboard.writeText(`${text}\n${urlACopier}`);
            document.getElementById('modal-title').textContent = 'Lien copié';
            document.getElementById('modal-body').innerHTML = `
                <p style="text-align:center;color:#374151;padding:20px 0">Le lien a été copié dans le presse-papier.</p>
                <button onclick="closeModal()" style="width:100%;padding:12px;background:#7c3aed;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">OK</button>
            `;
            document.getElementById('overlay').classList.add('on');
        } catch (e) {
            console.error('clipboard', e);
        }
    }
}

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
