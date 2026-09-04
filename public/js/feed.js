// ============================================================
// public/js/feed.js
// Fil social — onglet Accueil.
// MODULE @TAG : suggestions temps réel, mentions cliquables.
// Dépend de : app.js (getUser), profil.js (construireTrigramme)
// ============================================================

let feedFilter = 'all';
let feedFollowing = [];
let feedHashtag = null;

const RESONANCES = [
    { type: 'douceur',     label: 'Douceur',     icone: '🩷', couleur: '#f9a8d4' },
    { type: 'energie',     label: 'Énergie',     icone: '⚡', couleur: '#fcd34d' },
    { type: 'calme',       label: 'Calme',       icone: '🌙', couleur: '#a5b4fc' },
    { type: 'inspiration', label: 'Inspiration', icone: '✨', couleur: '#6ee7b7' }
];

// ── Trigramme unifié — source : profil.js ─────────────────────
function _feedTrigramme(prenom, nom, fallback) {
    if (typeof construireTrigramme === 'function') {
        return construireTrigramme(prenom, nom) || (fallback?.[0] || '?').toUpperCase();
    }
    const mots = [...(prenom || '').split(/\s+/), ...(nom || '').split(/\s+/)]
        .map(m => m.trim()).filter(Boolean);
    return mots.slice(0, 3).map(m => m[0].toUpperCase()).join('') || (fallback?.[0] || '?').toUpperCase();
}

// ── Avatar HTML unifié ────────────────────────────────────────
function _feedAvatarHTML(photo, prenom, nom, username, taille = 36) {
    if (photo) {
        return `<img src="${photo}"
            style="width:${taille}px;height:${taille}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`;
    }
    const trig = _feedTrigramme(prenom, nom, username);
    return `<div style="width:${taille}px;height:${taille}px;border-radius:50%;
        background:linear-gradient(135deg,#e9d5ff,#fbcfe8);
        color:#7c3aed;font-size:${Math.round(taille * 0.33)}px;font-weight:700;
        display:flex;align-items:center;justify-content:center;flex-shrink:0">${trig}</div>`;
}

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

// ── HEADER FEED ───────────────────────────────────────────────
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
        _bindResonances();
    } catch {
        list.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>';
    }
}

// ── RENDER HASHTAGS ───────────────────────────────────────────
function _renderHashtags(texte) {
    return texte.replace(/(<[^>]*>)|#([a-zA-ZÀ-ÿ0-9_]+)/g, (match, tag_html, tag) => {
        if (tag_html) return tag_html;
        return `<span class="hashtag-tag" data-tag="${tag.toLowerCase()}" style="color:#7c3aed;font-weight:600;cursor:pointer">#${tag}</span>`;
    });
}

// ── RENDER CONTENU AVEC MENTIONS ──────────────────────────────
function renderContenuAvecMentions(contenu, mentionsData) {
    if (!contenu) return '';
    if (!mentionsData || !mentionsData.length) {
        return _renderHashtags(
            escapeHtml(contenu).replace(/@toutlemonde/gi,
                '<span class="mention-tag" style="color:#7c3aed;font-weight:600;cursor:default">@Tout le monde</span>')
        );
    }
    let result = contenu;
    const sorted = [...mentionsData].sort((a, b) => {
        const fa = `${a.prenom || ''} ${a.nom || ''}`.trim();
        const fb = `${b.prenom || ''} ${b.nom || ''}`.trim();
        return fb.length - fa.length;
    });
    const placeholders = [];
    for (const m of sorted) {
        if (!m || !m.id) continue;
        const full = `${m.prenom || ''} ${m.nom || ''}`.trim();
        if (!full) continue;
        const tag = `@${full}`;
        const placeholder = `%%MENTION_${m.id}%%`;
        if (result.includes(tag)) {
            result = result.split(tag).join(placeholder);
            placeholders.push({
                placeholder,
                html: `<span class="mention-tag" data-user-id="${m.id}" style="color:#7c3aed;font-weight:600;cursor:pointer">@${escapeHtml(full)}</span>`
            });
        }
    }
    result = result.replace(/@toutlemonde/gi, '%%TOUTLEMONDE%%');
    result = escapeHtml(result);
    for (const { placeholder, html } of placeholders) {
        result = result.split(escapeHtml(placeholder)).join(html);
    }
    result = result.split('%%TOUTLEMONDE%%').join(
        '<span class="mention-tag" style="color:#7c3aed;font-weight:600;cursor:default">@Tout le monde</span>'
    );
    return _renderHashtags(result);
}

// ── CLIC MENTION ──────────────────────────────────────────────
document.addEventListener('click', e => {
    const tag = e.target.closest('.mention-tag');
    if (!tag) return;
    e.stopPropagation();
    const userId = parseInt(tag.dataset.userId);
    if (userId) ouvrirProfilPublic(userId);
});

// ── CLIC HASHTAG ──────────────────────────────────────────────
document.addEventListener('click', e => {
    const tag = e.target.closest('.hashtag-tag');
    if (!tag) return;
    e.stopPropagation();
    filtrerParHashtag(tag.dataset.tag);
});

// ── FILTRE HASHTAG ────────────────────────────────────────────
async function filtrerParHashtag(tag) {
    feedFilter = 'hashtag';
    feedHashtag = tag;
    document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
    const list = document.getElementById('feed-list');
    if (!list) return;
    list.innerHTML = '<div class="feed-loading">Chargement...</div>';
    const user = getUser();
    try {
        const r = await fetch(`/api/feed?hashtag=${encodeURIComponent(tag)}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();
        const header = document.querySelector('.feed-header');
        const existing = document.getElementById('hashtag-banner');
        if (existing) existing.remove();
        if (header) {
            const banner = document.createElement('div');
            banner.id = 'hashtag-banner';
            banner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:#ede9fe;border-radius:10px;margin-bottom:8px;font-size:13px;font-weight:600;color:#7c3aed';
            banner.innerHTML = `#${tag} <button onclick="clearHashtagFilter()" style="margin-left:auto;background:none;border:none;font-size:16px;cursor:pointer;color:#7c3aed;line-height:1">✕</button>`;
            header.insertAdjacentElement('afterend', banner);
        }
        if (!d.posts.length) {
            list.innerHTML = `<div class="feed-empty">Aucun post avec #${tag}.</div>`;
            return;
        }
        list.innerHTML = d.posts.map(p => renderPost(p)).join('');
        _bindResonances();
    } catch {
        list.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>';
    }
}

async function clearHashtagFilter() {
    feedFilter = 'all';
    feedHashtag = null;
    const banner = document.getElementById('hashtag-banner');
    if (banner) banner.remove();
    document.querySelectorAll('.feed-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'all');
    });
    await chargerFeed();
}

// ── @MENTION AUTOCOMPLETE ─────────────────────────────────────
function initMentions(inputEl, wrapEl) {
    if (!inputEl || !wrapEl) return;
    let dropEl = wrapEl.querySelector('.mention-dropdown');
    if (!dropEl) {
        dropEl = document.createElement('div');
        dropEl.className = 'mention-dropdown';
        wrapEl.style.position = 'relative';
        wrapEl.appendChild(dropEl);
    }
    let debounceTimer = null;
    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => _mentionInput(inputEl, dropEl), 200);
    });
    inputEl.addEventListener('keydown', e => {
        if (dropEl.style.display === 'none' || !dropEl.children.length) return;
        const items = [...dropEl.querySelectorAll('.mention-item')];
        const cur = dropEl.querySelector('.mention-item.active');
        const idx = items.indexOf(cur);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = items[Math.min(idx + 1, items.length - 1)];
            if (cur) cur.classList.remove('active');
            if (next) next.classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = items[Math.max(idx - 1, 0)];
            if (cur) cur.classList.remove('active');
            if (prev) prev.classList.add('active');
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            const active = dropEl.querySelector('.mention-item.active');
            if (active) {
                e.preventDefault();
                if (active.dataset.special === 'toutlemonde') _insererToutLeMonde(inputEl, dropEl);
                else _insererMention(inputEl, dropEl, active.dataset.prenom, active.dataset.nom);
            }
        } else if (e.key === 'Escape') {
            _fermerDropdown(dropEl);
        }
    });
    document.addEventListener('click', e => {
        if (!wrapEl.contains(e.target)) _fermerDropdown(dropEl);
    }, { capture: true });
}

async function _mentionInput(inputEl, dropEl) {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const avant = val.substring(0, cursor);
    const match = avant.match(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/);
    if (!match) { _fermerDropdown(dropEl); return; }
    const q = match[1].trim();
    if (!q) { _fermerDropdown(dropEl); return; }
    const user = getUser();
    const isAdmin = user.role === 'admin';
    try {
        const r = await fetch(`/api/feed/users?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) { _fermerDropdown(dropEl); return; }
        const items = [];
        if (isAdmin && 'toutlemonde'.startsWith(q.toLowerCase())) {
            items.push(`
                <div class="mention-item active" data-special="toutlemonde"
                     style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer">
                    <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6d28d9);
                                color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;
                                justify-content:center;flex-shrink:0">📢</div>
                    <span style="font-size:13px;font-weight:700;color:#7c3aed">@toutlemonde</span>
                    <span style="font-size:11px;color:#9ca3af;margin-left:4px">Tout le monde</span>
                </div>`);
        }
        if (d.users.length) {
            d.users.forEach((u, i) => {
                const av = u.avatar
                    ? `<img src="${u.avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`
                    : `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#e9d5ff,#fbcfe8);color:#7c3aed;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${_feedTrigramme(u.prenom, u.nom, u.username)}</div>`;
                items.push(`
                    <div class="mention-item${items.length === 0 && i === 0 ? ' active' : ''}"
                         data-prenom="${escapeHtml(u.prenom || '')}"
                         data-nom="${escapeHtml(u.nom || '')}">
                        ${av}
                        <span style="font-size:13px;font-weight:600;color:#111">${escapeHtml(u.prenom || '')} ${escapeHtml(u.nom || '')}</span>
                    </div>`);
            });
        }
        if (!items.length) { _fermerDropdown(dropEl); return; }
        dropEl.innerHTML = items.join('');
        dropEl.style.display = 'block';
        dropEl.querySelectorAll('.mention-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                if (item.dataset.special === 'toutlemonde') _insererToutLeMonde(inputEl, dropEl);
                else _insererMention(inputEl, dropEl, item.dataset.prenom, item.dataset.nom);
            });
        });
    } catch {
        _fermerDropdown(dropEl);
    }
}

function _insererMention(inputEl, dropEl, prenom, nom) {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const avant = val.substring(0, cursor);
    const apres = val.substring(cursor);
    const newAvant = avant.replace(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/, `@${prenom} ${nom}  `);
    inputEl.value = newAvant + apres;
    const pos = newAvant.length;
    inputEl.setSelectionRange(pos, pos);
    inputEl.focus();
    _fermerDropdown(dropEl);
}

function _insererToutLeMonde(inputEl, dropEl) {
    const val = inputEl.value;
    const cursor = inputEl.selectionStart;
    const avant = val.substring(0, cursor);
    const apres = val.substring(cursor);
    const newAvant = avant.replace(/@([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ \t]{0,40})$/, '@toutlemonde ');
    inputEl.value = newAvant + apres;
    const pos = newAvant.length;
    inputEl.setSelectionRange(pos, pos);
    inputEl.focus();
    _fermerDropdown(dropEl);
}

function _fermerDropdown(dropEl) {
    if (dropEl) {
        dropEl.innerHTML = '';
        dropEl.style.display = 'none';
    }
}

// ── DÉTECTION MOBILE ──────────────────────────────────────────
function _isMobile() {
    return window.matchMedia('(pointer: coarse)').matches;
}

// ── RENDER RÉSONANCES BOUTON BAS ──────────────────────────────
function _renderResonanceBouton(postId, maResonance, resonancesStats) {
    const stats = resonancesStats || [];
    const total = stats.reduce((s, r) => s + (r.nb || 0), 0);
    const actifs = RESONANCES.filter(r => stats.find(s => s.type === r.type && s.nb > 0));

    if (!total) {
        return `<button class="feed-resonance-btn" onclick="ouvrirArcResonance(this, event)">
            <span class="feed-resonance-neutre">✦</span>
            <span class="feed-resonance-label-neutre">Résonances</span>
        </button>`;
    }

    const icones = actifs.map(r => {
        const isMine = maResonance === r.type;
        return `<span class="feed-resonance-icone${isMine ? ' mine' : ''}">${r.icone}</span>`;
    }).join('');

        return `<div style="display:flex;align-items:center;gap:8px">
        <button class="feed-resonance-btn" onclick="ouvrirArcResonance(this, event)">
            <span class="feed-resonance-icones">${icones}</span>
        </button>
        <button class="feed-resonance-count-btn" onclick="voirLikers(${postId}, event)"
            style="background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:#6b7280;padding:4px 0;transition:color .2s"
            onmouseover="this.style.color='#7c3aed'" onmouseout="this.style.color='#6b7280'">
            ${total}
        </button>
    </div>`;
}

// ── RENDER POST ───────────────────────────────────────────────
function renderPost(p) {
    const user = getUser();
    const isOwner = user.username === p.username;
    const isAdmin = user.role === 'admin';
    const avatar = p.avatar
        ? `<img src="${p.avatar}" class="feed-avatar" alt="">`
        : `<div class="feed-avatar feed-avatar-initiale">${_feedTrigramme(p.prenom, p.nom, p.username)}</div>`;
    const date = new Date(p.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const followed = feedFollowing.includes(p.user_id);

    const lieuTag = (() => {
        const parts = [];
        if (p.lieu) parts.push(`📍 ${escapeHtml(p.lieu)}`);
        if (p.personnes_taguees && p.personnes_taguees.length) parts.push(`· Avec l'équipe`);
        return parts.length ? `<div class="feed-lieu">${parts.join(' ')}</div>` : '';
    })();

    return `
        <div class="feed-card" id="post-${p.id}" data-post-id="${p.id}" data-photo-url="${escapeHtml(p.photo_url || '')}">
            <div class="feed-card-header">
                <div class="feed-user" onclick="ouvrirProfilPublic(${p.user_id})">
                    ${avatar}
                    <div>
                        <div class="feed-username">${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')}</div>
                        <div class="feed-handle">@${escapeHtml(p.username)} · ${date}</div>
                    </div>
                </div>
                <div class="feed-card-actions">
                    ${!isOwner ? `<button class="feed-follow-btn ${followed ? 'following' : ''}" onclick="toggleFollow(${p.user_id}, this)">${followed ? 'Abonné' : 'Suivre'}</button>` : ''}
                    ${isOwner || isAdmin ? `
                                        <button class="feed-delete-btn" onclick="supprimerPost(${p.id})" title="Supprimer">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>` : ''}
                </div>
            </div>
            ${p.contenu ? `<div class="feed-content">${renderContenuAvecMentions(p.contenu, p.mentions)}</div>` : ''}
            ${lieuTag}
            ${p.photo_url ? `<img src="${p.photo_url}" class="feed-photo" onclick="ouvrirPhotoFeed('${escapeHtml(p.photo_url)}')" alt="">` : ''}
            <div class="feed-card-footer">
                ${_renderResonanceBouton(p.id, p.ma_resonance, p.resonances)}
                <button class="feed-comment-btn" onclick="toggleComments(${p.id})">
                    💬 ${p.nb_commentaires || 0}
                </button>
            </div>
            <div class="feed-comments" id="comments-${p.id}" style="display:none"></div>
        </div>
    `;
}

// ── ARC RÉSONANCE (long-press / click) ────────────────────────
function ouvrirArcResonance(btn, event) {
    event.stopPropagation();
    document.querySelectorAll('.feed-resonance-arc').forEach(a => a.remove());
    const postCard = btn.closest('.feed-card');
    const postId = postCard.dataset.postId;
    const rect = btn.getBoundingClientRect();
    const arc = document.createElement('div');
    arc.className = 'feed-resonance-arc';
    arc.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top - 54}px;display:flex;gap:6px;background:#fff;padding:6px 8px;border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:9999`;
    arc.innerHTML = RESONANCES.map(r => `
        <button class="feed-resonance-arc-btn" data-type="${r.type}" style="background:none;border:none;font-size:22px;cursor:pointer;transition:transform .15s;padding:2px" title="${r.label}">${r.icone}</button>
    `).join('');
    document.body.appendChild(arc);
    arc.querySelectorAll('.feed-resonance-arc-btn').forEach(b => {
        b.addEventListener('mouseenter', () => b.style.transform = 'scale(1.3)');
        b.addEventListener('mouseleave', () => b.style.transform = 'scale(1)');
        b.addEventListener('click', async e => {
            e.stopPropagation();
            await envoyerResonance(postId, b.dataset.type);
            arc.remove();
        });
    });
    setTimeout(() => {
        document.addEventListener('click', function fermer(e) {
            if (!arc.contains(e.target)) {
                arc.remove();
                document.removeEventListener('click', fermer);
            }
        });
    }, 10);
}

async function envoyerResonance(postId, type) {
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}/resonance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
            body: JSON.stringify({ type })
        });
        const d = await r.json();
        if (d.success) await chargerFeed();
    } catch {}
}

// ── VOIR LIKERS ───────────────────────────────────────────────
async function voirLikers(postId, event) {
    event.stopPropagation();
    const user = getUser();
    try {
        const r = await fetch(`/api/feed/${postId}/resonances`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal-box" style="max-width:360px">
                <div class="modal-header">
                    <h3>Résonances</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <div class="modal-body" style="padding:0">
                    ${d.users.map(u => {
                        const res = RESONANCES.find(r => r.type === u.resonance_type);
                        return `
                        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer"
                             onclick="this.closest('.modal-overlay').remove();ouvrirProfilPublic(${u.id})">
                            ${_feedAvatarHTML(u.avatar, u.prenom, u.nom, u.username, 38)}
                            <div style="flex:1">
                                <div style="font-size:13px;font-weight:700;color:#111">${escapeHtml(u.prenom || '')} ${escapeHtml(u.nom || '')}</div>
                                <div style="font-size:11px;color:#9ca3af">@${escapeHtml(u.username)}</div>
                            </div>
                            <span style="font-size:20px">${res ? res.icone : '✦'}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch {}
}

// ── TOGGLE FOLLOW (depuis carte post) ─────────────────────────
async function toggleFollow(userId, btn) {
    const user = getUser();
    const followed = btn.classList.contains('following');
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, {
            method: followed ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            btn.classList.toggle('following');
            btn.textContent = followed ? 'Suivre' : 'Abonné';
            if (followed) feedFollowing = feedFollowing.filter(id => id !== userId);
            else feedFollowing.push(userId);
        }
    } catch {}
}

// ── PROFIL PUBLIC (MODALE) — MODERNISÉE ───────────────────────
async function ouvrirProfilPublic(userId) {
    const user = getUser();
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal-box" style="max-width:400px">
            <div class="modal-header">
                <h3>Profil</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body" id="ppm-body-${userId}" style="display:flex;justify-content:center;padding:30px">
                <span style="color:#9ca3af;font-size:13px">Chargement...</span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        const r = await fetch(`/api/profil/public/${userId}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        const body = document.getElementById(`ppm-body-${userId}`);
        if (!body) return;
        if (!d.success) {
            body.innerHTML = `<span style="color:#9ca3af;font-size:13px">Erreur de chargement du profil.</span>`;
            return;
        }
        const p = d.profil;
        const followed = feedFollowing.includes(userId);
        const isOwner = user.id === userId;

        const avatarHTML = p.photo
            ? `<img src="${p.photo}" alt="">`
            : `<div class="ppm-avatar-initiales">${_feedTrigramme(p.prenom, p.nom, p.username)}</div>`;

        const infoRows = [
            p.age != null ? { icone: '🎂', label: 'Âge', val: `${p.age} ans` } : null,
            p.profession ? { icone: '💼', label: 'Profession', val: escapeHtml(p.profession) } : null,
            p.site_web ? { icone: '🔗', label: 'Site', val: `<a href="${escapeHtml(p.site_web)}" target="_blank" rel="noopener">${escapeHtml(p.site_web)}</a>` } : null,
            p.signe_astro ? { icone: p.signe_astro.emoji || '♓', label: 'Signe astro', val: escapeHtml(p.signe_astro.label || '') } : null
        ].filter(Boolean);

        body.innerHTML = `
            <div class="ppm-wrap">
                <div class="ppm-avatar-ring">${avatarHTML}</div>
                <div class="ppm-identite">
                    <div class="ppm-nom">${escapeHtml(p.prenom || '')} ${escapeHtml(p.nom || '')}</div>
                    <div class="ppm-username">@${escapeHtml(p.username)}</div>
                </div>
                <div class="ppm-stats">
                    <div class="ppm-stat">
                        <div class="ppm-stat-val">${p.nb_posts ?? 0}</div>
                        <div class="ppm-stat-label">Posts</div>
                    </div>
                    <div class="ppm-stat">
                        <div class="ppm-stat-val">${p.nb_abonnes ?? 0}</div>
                        <div class="ppm-stat-label">Abonnés</div>
                    </div>
                    <div class="ppm-stat">
                        <div class="ppm-stat-val">${p.nb_abonnements ?? 0}</div>
                        <div class="ppm-stat-label">Abonnements</div>
                    </div>
                </div>
                ${infoRows.length ? `
                <div class="ppm-infos">
                    ${infoRows.map(row => `
                        <div class="ppm-info-row">
                            <span class="ppm-info-icone">${row.icone}</span>
                            <span class="ppm-info-label">${row.label}</span>
                            <span class="ppm-info-val">${row.val}</span>
                        </div>
                    `).join('')}
                </div>` : ''}
                ${p.note ? `
                <div class="ppm-note">
                    <div class="ppm-note-label">Note</div>
                    <div class="ppm-note-texte">${escapeHtml(p.note)}</div>
                </div>` : ''}
                ${!isOwner ? `
                <button class="ppm-btn-suivre ${followed ? 'suivi' : ''}" id="ppm-btn-follow-${userId}"
                    onclick="toggleFollowDepuisProfil(${userId}, this)">
                    ${followed ? 'Abonné' : 'Suivre'}
                </button>` : ''}
            </div>
        `;
    } catch {
        const body = document.getElementById(`ppm-body-${userId}`);
        if (body) body.innerHTML = `<span style="color:#9ca3af;font-size:13px">Erreur de chargement du profil.</span>`;
    }
}

// ── TOGGLE FOLLOW (depuis modale profil public) ───────────────
async function toggleFollowDepuisProfil(userId, btn) {
    const user = getUser();
    const followed = btn.classList.contains('suivi');
    try {
        const r = await fetch(`/api/feed/follow/${userId}`, {
            method: followed ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            btn.classList.toggle('suivi');
            btn.textContent = followed ? 'Suivre' : 'Abonné';
            if (followed) feedFollowing = feedFollowing.filter(id => id !== userId);
            else feedFollowing.push(userId);
            document.querySelectorAll(`.feed-follow-btn`).forEach(b => {
                const card = b.closest('.feed-card');
                if (card && parseInt(card.querySelector('.feed-user')?.getAttribute('onclick')?.match(/\d+/)?.[0]) === userId) {
                    b.classList.toggle('following', !followed);
                    b.textContent = followed ? 'Suivre' : 'Abonné';
                }
            });
        }
    } catch {}
}

// ── TOGGLE COMMENTS ───────────────────────────────────────────
async function toggleComments(postId) {
    const box = document.getElementById(`comments-${postId}`);
    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    await chargerCommentaires(postId);
}

async function chargerCommentaires(postId) {
    const user = getUser();
    const box = document.getElementById(`comments-${postId}`);
    if (!box) return;
    box.innerHTML = '<div class="feed-loading">Chargement...</div>';
    try {
        const r = await fetch(`/api/feed/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) throw new Error();
        box.innerHTML = `
            <div class="feed-comments-list">
                ${d.comments.map(c => `
                    <div class="feed-comment">
                        ${_feedAvatarHTML(c.avatar, c.prenom, c.nom, c.username, 28)}
                        <div class="feed-comment-body">
                            <span class="feed-comment-nom">${escapeHtml(c.prenom || '')} ${escapeHtml(c.nom || '')}</span>
                            <span class="feed-comment-texte">${escapeHtml(c.contenu)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="feed-comment-input-wrap">
                <input type="text" class="feed-comment-input" id="comment-input-${postId}" placeholder="Ajouter un commentaire...">
                <button class="feed-comment-send" onclick="envoyerCommentaire(${postId})">Envoyer</button>
            </div>
        `;
    } catch {
        box.innerHTML = '<div class="feed-empty">Erreur de chargement.</div>';
    }
}

async function envoyerCommentaire(postId) {
    const user = getUser();
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input || !input.value.trim()) return;
    const contenu = input.value.trim();
    try {
        const r = await fetch(`/api/feed/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
            body: JSON.stringify({ contenu })
        });
        const d = await r.json();
        if (d.success) {
            input.value = '';
            await chargerCommentaires(postId);
            await chargerFeed();
        }
    } catch {}
}

// ── PHOTO FEED (visionneuse) ───────────────────────────────────
function ouvrirPhotoFeed(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'z-index:10000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
        <img src="${url}" style="max-width:95%;max-height:95%;object-fit:contain">
        <button onclick="this.closest('.modal-overlay').remove()" style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:22px;width:40px;height:40px;border-radius:50%;cursor:pointer">✕</button>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

// ── UTIL ──────────────────────────────────────────────────────
function _bindResonances() {
    // hook réservé pour extensions futures (drag/long-press mobile)
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
