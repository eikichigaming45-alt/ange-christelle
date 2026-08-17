// ===================== WIDGET ADMIN (dashboard) =====================

async function chargerWidgetAdmin() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    if (!user?.userId || user.role !== 'admin') return;
    const el = document.getElementById('wc-admin');
    if (!el) return;
    try {
        const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) {
            el.innerHTML = '<p class="wa-error">Erreur serveur</p>';
            return;
        }
        el.innerHTML = `
            <div class="wa-stats-row">
                <div class="wa-stat wa-stat-blue">
                    <div class="wa-stat-val">${d.totalUsers}</div>
                    <div class="wa-stat-lbl">Utilisateurs</div>
                </div>
                <div class="wa-stat wa-stat-purple">
                    <div class="wa-stat-val">${d.totalAdmins}</div>
                    <div class="wa-stat-lbl">Admins</div>
                </div>
                <div class="wa-stat wa-stat-green">
                    <div class="wa-stat-val">${d.profilsRemplis}</div>
                    <div class="wa-stat-lbl">Profils remplis</div>
                </div>
                <div class="wa-stat wa-stat-orange">
                    <div class="wa-stat-val">${d.sansProfile}</div>
                    <div class="wa-stat-lbl">Sans profil</div>
                </div>
            </div>
            <div class="wa-activity-title">Dernière activité</div>
            ${(d.lastLogins || []).map(u => `
                <div class="wa-activity-row">
                    <div class="wa-avatar">${u.username[0].toUpperCase()}</div>
                    <div class="wa-username">${u.username}</div>
                    <span class="wa-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span>
                    <div class="wa-date">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</div>
                </div>
            `).join('')}
        `;
    } catch {
        el.innerHTML = '<p class="wa-error">Erreur réseau</p>';
    }
}

// ===================== MODALE ADMIN (Stats / Utilisateurs / Créer) =====================

async function chargerAdminStats() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('admin-tab-stats');
    if (!el) return;
    el.innerHTML = '<p class="ap-loading">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) {
            el.innerHTML = `<p class="ap-error">${d.message}</p>`;
            return;
        }
        el.innerHTML = `
            <div class="stat-grid">
                <div class="stat-card">
                    <div class="val" style="color:#2563eb">${d.totalUsers}</div>
                    <div class="lbl">Utilisateurs</div>
                </div>
                <div class="stat-card">
                    <div class="val" style="color:#7c3aed">${d.totalAdmins}</div>
                    <div class="lbl">Admins</div>
                </div>
                <div class="stat-card">
                    <div class="val" style="color:#16a34a">${d.profilsRemplis}</div>
                    <div class="lbl">Profils remplis</div>
                </div>
                <div class="stat-card">
                    <div class="val" style="color:#ea580c">${d.sansProfile}</div>
                    <div class="lbl">Sans profil</div>
                </div>
            </div>
            <div class="section-title">Dernière activité</div>
            ${(d.lastLogins || []).map(u => `
                <div class="activity-row">
                    <div class="u">
                        ${u.username}
                        <span class="user-card-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
                    </div>
                    <div class="d">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</div>
                </div>
            `).join('') || '<p style="color:#9ca3af;font-size:13px">Aucune activité.</p>'}
        `;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur réseau.</p>';
    }
}

async function chargerAdminUsers() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('admin-tab-users');
    if (!el) return;
    el.innerHTML = '<p class="ap-loading">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/users?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) {
            el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`;
            return;
        }
        el.innerHTML = (d.users || []).map(u => `
            <div class="user-card">
                <div class="user-card-header">
                    <div>
                        <span class="user-card-name">${u.username}</span>
                        <span class="user-card-role ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
                    </div>
                </div>
                <div class="user-card-meta">
                    Dernière connexion : ${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}
                </div>
                <div class="user-card-actions">
                    <button class="ua-btn ua-btn-blue" onclick="adminToggleRole(${u.id},'${u.role}')">
                        ${u.role === 'admin' ? '↓ Passer user' : '↑ Passer admin'}
                    </button>
                    <button class="ua-btn ua-btn-green" onclick="adminResetPwd(${u.id},'${u.username}')">
                        🔑 Changer MDP
                    </button>
                    <button class="ua-btn ua-btn-red" onclick="adminSupprimerUser(${u.id},'${u.username}')">
                        🗑 Supprimer
                    </button>
                </div>
            </div>
        `).join('') || '<p style="color:#9ca3af;font-size:13px">Aucun utilisateur.</p>';
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur réseau.</p>';
    }
}

async function adminToggleRole(id, roleActuel) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const newRole = roleActuel === 'admin' ? 'user' : 'admin';
    try {
        const r = await fetch(`/api/admin/users/${id}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, role: newRole })
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else adminAfficherMsg('admin-tab-users', d.message, true);
    } catch {
        adminAfficherMsg('admin-tab-users', 'Erreur réseau.', true);
    }
}

function adminResetPwd(id, username) {
    const el = document.getElementById('admin-tab-users');
    el.innerHTML = `
        <div class="user-card">
            <div class="user-card-name" style="margin-bottom:12px">
                🔑 Nouveau mot de passe pour <strong>${username}</strong>
            </div>
            <div class="user-card-actions" style="flex-direction:column;align-items:stretch">
                <input type="password" id="admin-new-pwd" placeholder="Minimum 6 caractères"
                    style="padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;
                           font-size:14px;outline:none;width:100%;box-sizing:border-box">
                <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="ua-btn ua-btn-blue" style="flex:1" onclick="adminConfirmResetPwd(${id})">
                        ✓ Confirmer
                    </button>
                    <button class="ua-btn" style="flex:1;background:#f3f4f6;color:#374151"
                        onclick="chargerAdminUsers()">Annuler</button>
                </div>
                <div id="admin-pwd-msg" style="margin-top:8px;font-size:13px;color:#ef4444;text-align:center"></div>
            </div>
        </div>
    `;
}

async function adminConfirmResetPwd(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const pwd = document.getElementById('admin-new-pwd')?.value?.trim();
    const msg = document.getElementById('admin-pwd-msg');
    if (!pwd || pwd.length < 6) {
        if (msg) msg.textContent = 'Minimum 6 caractères.';
        return;
    }
    try {
        const r = await fetch(`/api/admin/users/${id}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, password: pwd })
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else if (msg) msg.textContent = d.message || 'Erreur.';
    } catch {
        if (msg) msg.textContent = 'Erreur réseau.';
    }
}

function adminSupprimerUser(id, username) {
    const el = document.getElementById('admin-tab-users');
    el.innerHTML = `
        <div class="user-card" style="border-color:#fee2e2;background:#fff5f5">
            <div style="font-size:32px;text-align:center;margin-bottom:8px">🗑</div>
            <div class="user-card-name" style="text-align:center;margin-bottom:6px">
                Supprimer <strong>${username}</strong> ?
            </div>
            <div class="user-card-meta" style="text-align:center;margin-bottom:16px">
                Cette action est irréversible.
            </div>
            <div style="display:flex;gap:8px">
                <button class="ua-btn ua-btn-red" style="flex:1" onclick="adminConfirmSupprimer(${id})">
                    Confirmer la suppression
                </button>
                <button class="ua-btn" style="flex:1;background:#f3f4f6;color:#374151"
                    onclick="chargerAdminUsers()">Annuler</button>
            </div>
        </div>
    `;
}

async function adminConfirmSupprimer(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    try {
        const r = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId })
        });
        const d = await r.json();
        if (d.success) chargerAdminUsers();
        else adminAfficherMsg('admin-tab-users', d.message, true);
    } catch {
        adminAfficherMsg('admin-tab-users', 'Erreur réseau.', true);
    }
}

async function creerUser() {
    const user     = JSON.parse(localStorage.getItem('myvibe_user'));
    const username = document.getElementById('new-username')?.value?.trim();
    const password = document.getElementById('new-password')?.value?.trim();
    const role     = document.getElementById('new-role')?.value;
    const msg      = document.getElementById('create-msg');
    if (!username || !password) {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Champs requis.'; }
        return;
    }
    try {
        const r = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, username, password, role })
        });
        const d = await r.json();
        if (msg) {
            msg.style.color = d.success ? '#16a34a' : '#ef4444';
            msg.textContent = d.success
                ? `✅ Utilisateur "${username}" créé avec succès.`
                : (d.message || 'Erreur.');
        }
        if (d.success) {
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
        }
    } catch {
        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Erreur réseau.'; }
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`admin-tab-${tab}`)?.classList.add('active');
    if (tab === 'stats') chargerAdminStats();
    if (tab === 'users') chargerAdminUsers();
}

function adminAfficherMsg(elId, texte, isError = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    const div = document.createElement('p');
    div.style.cssText = `color:${isError ? '#ef4444' : '#16a34a'};font-size:13px;margin-top:8px`;
    div.textContent = texte;
    el.prepend(div);
}
