// ============================================================
// public/js/eclats.js
// Éclats — stories 24h : upload, affichage 2 bandeaux
// Dépend de : app.js (getUser)
// ============================================================

// ── INIT ─────────────────────────────────────────────────────
async function initEclats() {
    await chargerEclats();
}

// ── CHARGER ÉCLATS ────────────────────────────────────────────
async function chargerEclats() {
    const user = getUser();
    try {
        const r = await fetch('/api/eclats', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (!d.success) return;
        _renderBandeaux(d.eclats, user);
    } catch {}
}

// ── RENDER 2 BANDEAUX ─────────────────────────────────────────
function _renderBandeaux(eclats, user) {
    const zone1 = document.getElementById('eclats-bandeau-1');
    const zone2 = document.getElementById('eclats-bandeau-2');
    if (!zone1 && !zone2) return;

    // Séparer mes éclats / éclats des autres
    const mesEclats    = eclats.filter(e => e.user_id === user.id);
    const autresEclats = eclats.filter(e => e.user_id !== user.id);

    if (zone1) {
        zone1.innerHTML = _renderBandeau(mesEclats, user, true);
        _bindUpload(zone1);
    }
    if (zone2) {
        zone2.innerHTML = _renderBandeau(autresEclats, user, false);
    }

    // Bind clics visionneuse
    document.querySelectorAll('.eclat-thumb').forEach(el => {
        el.addEventListener('click', () => ouvrirEclat(el.dataset.url, el.dataset.eclatId, el.dataset.userId));
    });
}

function _renderBandeau(eclats, user, isMine) {
    const btnAjouter = isMine ? `
        <div class="eclat-ajouter" onclick="ouvrirUploadEclat()" title="Ajouter un éclat">
            <span class="eclat-ajouter-icone">+</span>
        </div>` : '';

    if (!eclats.length && !isMine) return '';

    const items = eclats.map(e => {
        const initiale = (e.prenom?.[0] || e.username[0]).toUpperCase();
        const avatar   = e.avatar
            ? `<img src="${e.avatar}" class="eclat-avatar" alt="">`
            : `<div class="eclat-avatar eclat-avatar-initiale">${initiale}</div>`;
        return `
            <div class="eclat-item eclat-thumb"
                 data-url="${e.media_url}"
                 data-eclat-id="${e.id}"
                 data-user-id="${e.user_id}">
                <img src="${e.media_url}" class="eclat-img" alt="">
                <div class="eclat-overlay">
                    ${avatar}
                    ${isMine ? `<button class="eclat-delete-btn" onclick="supprimerEclat(${e.id}, event)" title="Supprimer">✕</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="eclats-bandeau">${btnAjouter}${items}</div>`;
}

// ── BIND UPLOAD ZONE ──────────────────────────────────────────
function _bindUpload(zone) {
    // Rien de supplémentaire — le bouton appelle ouvrirUploadEclat() directement
}

// ── OUVRIR MODAL UPLOAD ───────────────────────────────────────
function ouvrirUploadEclat() {
    document.getElementById('modal-title').textContent = 'Nouvel éclat';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;padding:8px 0">
            <label for="eclat-file-input" style="display:inline-block;cursor:pointer">
                <div id="eclat-preview-zone"
                     style="width:100%;min-height:200px;background:#f9fafb;border-radius:16px;
                            border:2px dashed #e5e7eb;display:flex;align-items:center;
                            justify-content:center;flex-direction:column;gap:10px;
                            font-size:14px;color:#9ca3af;font-weight:600;overflow:hidden">
                    <span style="font-size:36px">📸</span>
                    <span>Choisir une photo</span>
                </div>
            </label>
            <input type="file" id="eclat-file-input" accept="image/*"
                   style="display:none" onchange="previewEclat(this)">
        </div>
        <button onclick="publierEclat()"
            style="width:100%;margin-top:16px;padding:13px;
                   background:linear-gradient(135deg,#7c3aed,#6d28d9);
                   color:#fff;border:none;border-radius:12px;
                   font-size:15px;font-weight:600;cursor:pointer">
            Publier l'éclat
        </button>
        <div id="eclat-msg" style="text-align:center;margin-top:10px;font-size:13px;min-height:18px"></div>
    `;
    document.getElementById('overlay').classList.add('on');
}

function previewEclat(input) {
    const file = input.files[0];
    if (!file) return;
    const url  = URL.createObjectURL(file);
    const zone = document.getElementById('eclat-preview-zone');
    if (zone) {
        zone.innerHTML = `<img src="${url}"
            style="width:100%;max-height:300px;object-fit:contain;border-radius:14px">`;
    }
}

async function publierEclat() {
    const user  = getUser();
    const input = document.getElementById('eclat-file-input');
    const msg   = document.getElementById('eclat-msg');
    const file  = input?.files[0];
    if (!file) {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Choisir une photo.'; }
        return;
    }
    try {
        const photoB64 = await new Promise((resolve, reject) => {
            const reader   = new FileReader();
            reader.onload  = e => resolve(e.target.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const r = await fetch('/api/eclats', {
            method  : 'POST',
            headers : { 'Authorization': `Bearer ${user.token}`, 'Content-Type': 'application/json' },
            body    : JSON.stringify({ media: photoB64 })
        });
        const d = await r.json();
        if (d.success) {
            closeModal();
            await chargerEclats();
        } else {
            if (msg) { msg.style.color = '#ef4444'; msg.textContent = d.message || 'Erreur.'; }
        }
    } catch {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
    }
}

// ── VISIONNEUSE ÉCLAT ─────────────────────────────────────────
function ouvrirEclat(url, eclatId, userId) {
    const user    = getUser();
    const isMine  = String(userId) === String(user.id);
    document.getElementById('modal-title').textContent = '';
    document.getElementById('modal-body').innerHTML = `
        <div style="position:relative">
            <img src="${url}"
                 style="width:100%;border-radius:14px;max-height:70vh;object-fit:contain;display:block">
            ${isMine ? `
            <button onclick="supprimerEclat(${eclatId}, event)"
                style="position:absolute;top:10px;right:10px;
                       background:rgba(0,0,0,.5);color:#fff;border:none;
                       border-radius:50%;width:32px;height:32px;font-size:16px;
                       cursor:pointer;display:flex;align-items:center;justify-content:center">
                ✕
            </button>` : ''}
        </div>
    `;
    document.getElementById('overlay').classList.add('on');
}

// ── SUPPRIMER ÉCLAT ───────────────────────────────────────────
async function supprimerEclat(eclatId, e) {
    if (e) e.stopPropagation();
    const user = getUser();
    try {
        const r = await fetch(`/api/eclats/${eclatId}`, {
            method : 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();
        if (d.success) {
            const el = document.getElementById('overlay');
            if (el) el.classList.remove('on');
            await chargerEclats();
        }
    } catch {}
}
