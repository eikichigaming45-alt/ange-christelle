// ============================================================
// public/js/feed.js
// Fil social — onglet Accueil.
// Dépend de : app.js (getUser)
// ============================================================

let feedFilter    = 'all';
let feedFollowing = [];

// ── INIT ─────────────────────────────────────────────────────
async function initFeed() {
    const el = document.getElementById('accueil-feed');
    if (!el) return;
    await chargerFollowing();
    renderFeedHeader();
    await chargerFeed();
}

// ── FOLLOWING LIST ────────────────────────────────────────────
async function chargerFollowing() {
    const user = getUser();
    try {
        const r = await fetch('/api/feed/following', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) feedFollowing = d.following;
    } catch {}
}

// ── HEADER FEED (filtre + bouton post) ───────────────────────
function renderFeedHeader() {
    const el = document.getElementById('accueil-feed');
    el.innerHTML = `
        <div class="feed-header">
            <div class="feed-filters">
                <button class="feed-filter-btn active" data-filter="all" onclick="setFeedFilter('all')">Tous</button>
                <button class="feed-filter-btn" data-filter="following" onclick="setFeedFilter('following')">Abonnements</button>
            </div>
            <button class="feed-new-btn" onclick="ouvrirModalPost()">+ Post</button>
        </div>
        <div id="feed-list"></div>
    `;
}

// ── FILTRE ────────────────────────────────────────────────────
async function setFeedFilter(filter) {
    feedFilter = filter;
    document.querySelectorAll('.feed-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filter);
    });
    await chargerFeed();
}

// ── CHARGER POSTS ─────────────────────────────────────────────
async function chargerFeed() {
    const user = getUser();
    const list = document.getElementById('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="feed-loading">Chargement...</div>';
    try {
        const r = await fetch(`/api/feed${feedFilter === 'following' ? '?filter=following' : ''}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();
        if (!d.posts.length) {
            list.innerHTML = '<div class="feed-empty">Aucun post pour l\'instant.</div>';
            return;
        }
        list.innerHTML = d.posts.map(p => renderPost(p)).join('');
    } catch {
        list.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>';
    }
}

// ── RENDER POST ───────────────────────────────────────────────
function renderPost(p) {
    const user     = getUser();
    const isOwner  = user.username === p.username;
    const isAdmin  = user.role === 'admin';
    const avatar   = p.avatar
        ? `<img src="${p.avatar}" class="feed-avatar" alt="">`
        : `<div class="feed-avatar feed-avatar-initiale">${(p.prenom?.[0] || p.username[0]).toUpperCase()}</div>`;
    const date     = new Date(p.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const followed = feedFollowing.includes(p.user_id);

    return `
        <div class="feed-card" id="post-${p.id}">
            <div class="feed-card-header">
                <div class="feed-user" onclick="ouvrirProfilPublic(${p.user_id})">
                    ${avatar}
                    <div>
                        <div class="feed-username">${p.prenom || ''} ${p.nom || ''}</div>
                        <div class="feed-handle">@${p.username} · ${date}</div>
                    </div>
                </div>
                <div class="feed-card-actions">
                    ${!isOwner ? `<button class="feed-follow-btn ${followed ? 'following' : ''}" onclick="toggleFollow(${p.user_id}, this)">${followed ? 'Abonné' : 'Suivre'}</button>` : ''}
                    ${isOwner || isAdmin ? `<button class="feed-delete-btn" onclick="supprimerPost(${p.id})">🗑</button>` : ''}
                </div>
            </div>
            ${p.contenu ? `<div class="feed-contenu">${escapeHtml(p.contenu)}</div>` : ''}
            ${p.photo_url ? `<img src="${p.photo_url}" class="feed-photo" alt="" onclick="ouvrirPhoto('${p.photo_url}')">` : ''}
            <div class="feed-footer">
                <button class="feed-like-btn ${p.liked ? 'liked' : ''}" onclick="toggleLike(${p.id}, this)">
                    ❤️ <span>${p.likes}</span>
                </button>
                <button class="feed-comment-btn" onclick="toggleCommentaires(${p.id})">
                    💬 <span>${p.nb_comments}</span>
                </button>
                <button class="feed-share-btn" onclick="partagerPost(${p.id}, '${escapeHtml(p.contenu || '')}')">
                    📤
                </button>
            </div>
            <div class="feed-comments" id="comments-${p.id}" style="display:none"></div>
        </div>
    `;
}

// ── LIKE ──────────────────────────────────────────────────────
async function toggleLike(postId, btn) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        btn.classList.toggle('liked', d.liked);
        const span = btn.querySelector('span');
        span.textContent = parseInt(span.textContent) + (d.liked ? 1 : -1);
    } catch {}
}

// ── COMMENTAIRES ──────────────────────────────────────────────
async function toggleCommentaires(postId) {
    const zone = document.getElementById(`comments-${postId}`);
    if (!zone) return;
    if (zone.style.display === 'none') {
        zone.style.display = 'block';
        await chargerCommentaires(postId);
    } else {
        zone.style.display = 'none';
    }
}

async function chargerCommentaires(postId) {
    const user = getUser();
    const zone = document.getElementById(`comments-${postId}`);
    zone.innerHTML = '<div class="feed-loading">Chargement...</div>';
    try {
        const r = await fetch(`/api/feed/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();
        zone.innerHTML = `
            ${d.comments.map(c => renderComment(c, postId)).join('')}
            <div class="feed-comment-form">
                <input type="text" id="comment-input-${postId}" placeholder="Écrire un commentaire..." class="feed-comment-input">
                <button onclick="envoyerCommentaire(${postId})" class="feed-comment-send">Envoyer</button>
            </div>
        `;
    } catch {
        zone.innerHTML = '<div class="feed-empty">Erreur.</div>';
    }
}

function renderComment(c, postId) {
    const user    = getUser();
    const isOwner = user.username === c.username;
    const isAdmin = user.role === 'admin';
    const date    = new Date(c.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `
        <div class="feed-comment" id="comment-${c.id}">
            <div class="feed-comment-meta">
                <span class="feed-comment-author">${c.prenom || ''} ${c.nom || ''} <span class="feed-handle">@${c.username}</span></span>
                <span class="feed-comment-date">${date}</span>
                ${isOwner || isAdmin ? `<button class="feed-comment-delete" onclick="supprimerCommentaire(${c.id}, ${postId})">🗑</button>` : ''}
            </div>
            <div class="feed-comment-contenu">${escapeHtml(c.contenu)}</div>
        </div>
    `;
}

async function envoyerCommentaire(postId) {
    const user  = getUser();
    const input = document.getElementById(`comment-input-${postId}`);
    const text  = (input?.value || '').trim();
    if (!text) return;
    try {
        const r = await fetch(`/api/feed/${postId}/comments`, {
            method : 'POST',
            headers: { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
            body   : JSON.stringify({ contenu: text })
        });
        const d = await r.json();
        if (d.success) {
            input.value = '';
            await chargerCommentaires(postId);
            const btn = document.querySelector(`#post-${postId} .feed-comment-btn span`);
            if (btn) btn.textContent = parseInt(btn.textContent) + 1;
        }
    } catch {}
}

async function supprimerCommentaire(commentId, postId) {
    if (!confirm('Confirmer la suppression ?')) return;
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/comments/${commentId}`, {
            method : 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById(`comment-${commentId}`)?.remove();
            const btn = document.querySelector(`#post-${postId} .feed-comment-btn span`);
            if (btn) btn.textContent = Math.max(0, parseInt(btn.textContent) - 1);
        }
    } catch {}
}

// ── SUPPRIMER POST ────────────────────────────────────────────
async function supprimerPost(postId) {
    if (!confirm('Confirmer la suppression ?')) return;
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}`, {
            method : 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) document.getElementById(`post-${postId}`)?.remove();
    } catch {}
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
    document.getElementById('overlay').classList.add('on');
    document.getElementById('modal-title').textContent = 'Nouveau post';
    document.getElementById('modal-body').innerHTML = `
        <textarea id="post-contenu" placeholder="Quoi de neuf ?" rows="4"
            style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;
                   font-size:14px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit"></textarea>
        <div style="margin-top:12px">
            <label style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;display:block;margin-bottom:6px">Photo (optionnelle)</label>
            <input type="file" id="post-photo" accept="image/*"
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
                const reader = new FileReader();
                reader.onload  = e => resolve(e.target.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(photo);
            });
        }

        const body = { contenu };
        if (photoB64) { body.photo = photoB64; body.mime = mime; }

        const r = await fetch('/api/feed', {
            method  : 'POST',
            headers : {
                'Authorization' : `Bearer ${user.token}`,
                'Content-Type'  : 'application/json'
            },
            body: JSON.stringify(body)
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
function ouvrirProfilPublic(userId) {
    // Sera implémenté lors du chantier Profil public
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
async function partagerPost(postId, contenu) {
    if (navigator.share) {
        try {
            await navigator.share({ title: 'MyDaily', text: contenu });
        } catch {}
    }
}

// ── ESCAPE HTML ───────────────────────────────────────────────
function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
