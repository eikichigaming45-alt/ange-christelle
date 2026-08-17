// ===================== WIDGET ADMIN =====================

async function chargerWidgetAdmin() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId || user.role !== 'admin') return;
    const el = document.getElementById('widget-admin-content');
    if (!el) return;
    try {
        const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) { el.innerHTML = '<p style="color:#ef4444">Erreur serveur</p>'; return; }

        const activite = (d.lastLogins || []).map(u => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
                <span><strong>${u.username}</strong> <span style="font-size:11px;color:#6b7280">(${u.role})</span></span>
                <span style="color:#9ca3af">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
        `).join('');

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="background:#eff6ff;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#2563eb">${d.totalUsers}</div>
                    <div style="font-size:11px;color:#6b7280">Utilisateurs</div>
                </div>
                <div style="background:#f5f3ff;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#7c3aed">${d.totalAdmins}</div>
                    <div style="font-size:11px;color:#6b7280">Admins</div>
                </div>
                <div style="background:#f0fdf4;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#16a34a">${d.profilsRemplis}</div>
                    <div style="font-size:11px;color:#6b7280">Profils remplis</div>
                </div>
                <div style="background:#fff7ed;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:22px;font-weight:700;color:#ea580c">${d.sansProfile}</div>
                    <div style="font-size:11px;color:#6b7280">Sans profil</div>
                </div>
            </div>
            <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">DERNIÈRE ACTIVITÉ</div>
            ${activite}
            <button onclick="ouvrirAdmin()" style="margin-top:12px;width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
                ⚙️ Accès admin
            </button>
        `;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur réseau</p>';
    }
}

// ===================== ADMIN PANEL PLEIN ÉCRAN =====================

function ouvrirAdmin() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId || user.role !== 'admin') return;

    document.getElementById('admin-fullpanel')?.remove();

    const panel = document.createElement('div');
    panel.id = 'admin-fullpanel';
    panel.innerHTML = `
        <div class="ap-sidebar">
            <div class="ap-logo">⚙️ Admin</div>
            <nav class="ap-nav">
                <button class="ap-navbtn active" onclick="apSwitch('overview', this)">📊 Vue d'ensemble</button>
                <button class="ap-navbtn" onclick="apSwitch('users', this)">👥 Utilisateurs</button>
                <button class="ap-navbtn" onclick="apSwitch('create', this)">➕ Créer</button>
            </nav>
            <button class="ap-close" onclick="fermerAdmin()">✕ Fermer</button>
        </div>
        <div class="ap-main">
            <div id="ap-section-overview" class="ap-section active"></div>
            <div id="ap-section-users"    class="ap-section"></div>
            <div id="ap-section-create"   class="ap-section"></div>
        </div>
    `;
    document.body.appendChild(panel);
    apChargerOverview();
}

function fermerAdmin() {
    document.getElementById('admin-fullpanel')?.remove();
}

function apSwitch(section, btn) {
    document.querySelectorAll('.ap-navbtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ap-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('ap-section-' + section)?.classList.add('active');
    if (section === 'overview') apChargerOverview();
    if (section === 'users')    apChargerUsers();
    if (section === 'create')   apAfficherCreer();
}

async function apChargerOverview() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('ap-section-overview');
    if (!el) return;
    el.innerHTML = '<p class="ap-loading">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) { el.innerHTML = '<p class="ap-err">Erreur serveur</p>'; return; }

        const activite = (d.lastLogins || []).map(u => `
            <tr>
                <td><span class="ap-badge ap-badge-${u.role}">${u.role}</span> ${u.username}</td>
                <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
        `).join('');

        el.innerHTML = `
            <h2 class="ap-title">Vue d'ensemble</h2>
            <div class="ap-stats-grid">
                <div class="ap-stat-card"><div class="ap-stat-num">${d.totalUsers}</div><div class="ap-stat-lbl">Utilisateurs</div></div>
                <div class="ap-stat-card"><div class="ap-stat-num">${d.totalAdmins}</div><div class="ap-stat-lbl">Admins</div></div>
                <div class="ap-stat-card"><div class="ap-stat-num">${d.profilsRemplis}</div><div class="ap-stat-lbl">Profils remplis</div></div>
                <div class="ap-stat-card"><div class="ap-stat-num">${d.sansProfile}</div><div class="ap-stat-lbl">Sans profil</div></div>
            </div>
            <h3 class="ap-subtitle">Dernière activité</h3>
            <table class="ap-table">
                <thead><tr><th>Utilisateur</th><th>Dernière connexion</th></tr></thead>
                <tbody>${activite}</tbody>
            </table>
        `;
    } catch {
        el.innerHTML = '<p class="ap-err">Erreur réseau</p>';
    }
}

async function apChargerUsers() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('ap-section-users');
    if (!el) return;
    el.innerHTML = '<p class="ap-loading">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/users?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) { el.innerHTML = '<p class="ap-err">Erreur serveur</p>'; return; }

        const rows = (d.users || []).map(u => `
            <tr>
                <td><span class="ap-badge ap-badge-${u.role}">${u.role}</span></td>
                <td>${u.username}</td>
                <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</td>
                <td class="ap-actions">
                    <button class="ap-btn ap-btn-sm" onclick="apToggleRole(${u.id},'${u.role}')">
                        ${u.role === 'admin' ? '↓ User' : '↑ Admin'}
                    </button>
                    <button class="ap-btn ap-btn-sm ap-btn-warn" onclick="apResetPwd(${u.id},'${u.username}')">🔑 MDP</button>
                    <button class="ap-btn ap-btn-sm ap-btn-danger" onclick="apSupprimerUser(${u.id},'${u.username}')">🗑</button>
                </td>
            </tr>
        `).join('');

        el.innerHTML = `
            <h2 class="ap-title">Utilisateurs</h2>
            <table class="ap-table">
                <thead><tr><th>Rôle</th><th>Nom</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    } catch {
        el.innerHTML = '<p class="ap-err">Erreur réseau</p>';
    }
}

async function apToggleRole(id, roleActuel) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const newRole = roleActuel === 'admin' ? 'user' : 'admin';
    try {
        const r = await fetch(`/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, role: newRole })
        });
        const d = await r.json();
        if (d.success) apChargerUsers();
        else _adminModal('Erreur', d.message || 'Impossible de changer le rôle.');
    } catch {
        _adminModal('Erreur', 'Erreur réseau.');
    }
}

function apResetPwd(id, username) {
    _adminModal('Réinitialiser le mot de passe', `
        <p style="margin-bottom:12px">Nouveau mot de passe pour <strong>${username}</strong> :</p>
        <input type="password" id="ap-new-pwd" placeholder="Nouveau mot de passe"
            style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:12px">
        <button class="ap-btn" onclick="apConfirmResetPwd(${id})">Confirmer</button>
    `);
}

async function apConfirmResetPwd(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const pwd = document.getElementById('ap-new-pwd')?.value?.trim();
    if (!pwd) return;
    try {
        const r = await fetch(`/api/admin/users/${id}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, password: pwd })
        });
        const d = await r.json();
        _adminModal(d.success ? 'Succès' : 'Erreur', d.success ? 'Mot de passe mis à jour.' : (d.message || 'Erreur.'));
    } catch {
        _adminModal('Erreur', 'Erreur réseau.');
    }
}

function apSupprimerUser(id, username) {
    _adminModal('Supprimer', `
        <p>Supprimer définitivement <strong>${username}</strong> ?</p>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="ap-btn ap-btn-danger" onclick="apConfirmSupprimer(${id})">Supprimer</button>
            <button class="ap-btn" onclick="document.getElementById('ap-inner-modal')?.remove()">Annuler</button>
        </div>
    `);
}

async function apConfirmSupprimer(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    try {
        const r = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId })
        });
        const d = await r.json();
        document.getElementById('ap-inner-modal')?.remove();
        if (d.success) apChargerUsers();
        else _adminModal('Erreur', d.message || 'Impossible de supprimer.');
    } catch {
        _adminModal('Erreur', 'Erreur réseau.');
    }
}

function apAfficherCreer() {
    const el = document.getElementById('ap-section-create');
    if (!el) return;
    el.innerHTML = `
        <h2 class="ap-title">Créer un utilisateur</h2>
        <div class="ap-form">
            <input type="text" id="ap-c-user" placeholder="Nom d'utilisateur"
                style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;width:100%;box-sizing:border-box">
            <input type="password" id="ap-c-pwd" placeholder="Mot de passe"
                style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;width:100%;box-sizing:border-box">
            <select id="ap-c-role"
                style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;width:100%;box-sizing:border-box">
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
            </select>
            <button class="ap-btn" onclick="apCreerUser()">Créer l'utilisateur</button>
            <div id="ap-c-msg" style="font-size:13px;margin-top:8px"></div>
        </div>
    `;
}

async function apCreerUser() {
    const user     = JSON.parse(localStorage.getItem('myvibe_user'));
    const username = document.getElementById('ap-c-user')?.value?.trim();
    const password = document.getElementById('ap-c-pwd')?.value?.trim();
    const role     = document.getElementById('ap-c-role')?.value;
    const msg      = document.getElementById('ap-c-msg');
    if (!username || !password) { if (msg) msg.textContent = 'Champs requis.'; return; }
    try {
        const r = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, username, password, role })
        });
        const d = await r.json();
        if (msg) msg.textContent = d.success ? '✅ Utilisateur créé.' : (d.message || 'Erreur.');
        if (d.success) {
            document.getElementById('ap-c-user').value = '';
            document.getElementById('ap-c-pwd').value  = '';
        }
    } catch {
        if (msg) msg.textContent = 'Erreur réseau.';
    }
}

function _adminModal(titre, contenu) {
    document.getElementById('ap-inner-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'ap-inner-modal';
    m.innerHTML = `
        <div class="ap-modal-backdrop" onclick="document.getElementById('ap-inner-modal')?.remove()"></div>
        <div class="ap-modal-box">
            <h3 style="margin:0 0 12px;font-size:16px;color:#1f2937">${titre}</h3>
            <div>${contenu}</div>
            <button class="ap-btn" style="margin-top:16px" onclick="document.getElementById('ap-inner-modal')?.remove()">Fermer</button>
        </div>
    `;
    document.getElementById('admin-fullpanel')?.appendChild(m);
}
