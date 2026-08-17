// ===================== ADMIN =====================

async function chargerAdminStats() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('admin-tab-stats');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) { el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`; return; }

        const activite = (d.lastLogins || []).map(u => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px">
                <span><strong>${u.username}</strong> <span style="font-size:11px;color:#6b7280">(${u.role})</span></span>
                <span style="color:#9ca3af">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
        `).join('');

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
                <div style="background:#eff6ff;border-radius:10px;padding:14px;text-align:center">
                    <div style="font-size:26px;font-weight:700;color:#2563eb">${d.totalUsers}</div>
                    <div style="font-size:11px;color:#6b7280">Utilisateurs</div>
                </div>
                <div style="background:#f5f3ff;border-radius:10px;padding:14px;text-align:center">
                    <div style="font-size:26px;font-weight:700;color:#7c3aed">${d.totalAdmins}</div>
                    <div style="font-size:11px;color:#6b7280">Admins</div>
                </div>
                <div style="background:#f0fdf4;border-radius:10px;padding:14px;text-align:center">
                    <div style="font-size:26px;font-weight:700;color:#16a34a">${d.profilsRemplis}</div>
                    <div style="font-size:11px;color:#6b7280">Profils remplis</div>
                </div>
                <div style="background:#fff7ed;border-radius:10px;padding:14px;text-align:center">
                    <div style="font-size:26px;font-weight:700;color:#ea580c">${d.sansProfile}</div>
                    <div style="font-size:11px;color:#6b7280">Sans profil</div>
                </div>
            </div>
            <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">DERNIÈRE ACTIVITÉ</div>
            ${activite || '<p style="color:#9ca3af;font-size:13px">Aucune activité.</p>'}
        `;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur réseau.</p>';
    }
}

async function chargerAdminUsers() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const el = document.getElementById('admin-tab-users');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af">Chargement...</p>';
    try {
        const r = await fetch(`/api/admin/users?adminId=${user.userId}`);
        const d = await r.json();
        if (!d.success) { el.innerHTML = `<p style="color:#ef4444">${d.message}</p>`; return; }

        const rows = (d.users || []).map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;gap:8px;flex-wrap:wrap">
                <div>
                    <span style="font-weight:600;font-size:14px">${u.username}</span>
                    <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:20px;background:${u.role === 'admin' ? '#ede9fe' : '#f3f4f6'};color:${u.role === 'admin' ? '#7c3aed' : '#6b7280'}">${u.role}</span>
                    <div style="font-size:11px;color:#9ca3af;margin-top:2px">${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : 'Jamais connecté'}</div>
                </div>
                <div style="display:flex;gap:6px">
                    <button onclick="adminToggleRole(${u.id},'${u.role}')"
                        style="font-size:12px;padding:5px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer">
                        ${u.role === 'admin' ? '↓ User' : '↑ Admin'}
                    </button>
                    <button onclick="adminResetPwd(${u.id},'${u.username}')"
                        style="font-size:12px;padding:5px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer">
                        🔑
                    </button>
                    <button onclick="adminSupprimerUser(${u.id},'${u.username}')"
                        style="font-size:12px;padding:5px 10px;border:none;border-radius:6px;background:#fee2e2;color:#dc2626;cursor:pointer">
                        🗑
                    </button>
                </div>
            </div>
        `).join('');

        el.innerHTML = rows || '<p style="color:#9ca3af;font-size:13px">Aucun utilisateur.</p>';
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
        else alert(d.message);
    } catch { alert('Erreur réseau.'); }
}

function adminResetPwd(id, username) {
    const body = document.getElementById('modal-body');
    const ancien = document.getElementById('admin-tab-users').innerHTML;
    document.getElementById('admin-tab-users').innerHTML = `
        <p style="font-size:14px;margin-bottom:12px">Nouveau mot de passe pour <strong>${username}</strong> :</p>
        <input type="password" id="admin-new-pwd" placeholder="Minimum 6 caractères"
            style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;box-sizing:border-box;margin-bottom:10px">
        <div style="display:flex;gap:8px">
            <button onclick="adminConfirmResetPwd(${id})"
                style="flex:1;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">Confirmer</button>
            <button onclick="chargerAdminUsers()"
                style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;cursor:pointer;font-weight:600">Annuler</button>
        </div>
        <div id="admin-pwd-msg" style="margin-top:8px;font-size:13px;text-align:center"></div>
    `;
}

async function adminConfirmResetPwd(id) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const pwd = document.getElementById('admin-new-pwd')?.value?.trim();
    const msg = document.getElementById('admin-pwd-msg');
    if (!pwd || pwd.length < 6) { if(msg) msg.textContent = 'Minimum 6 caractères.'; return; }
    try {
        const r = await fetch(`/api/admin/users/${id}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, password: pwd })
        });
        const d = await r.json();
        if (d.success) { chargerAdminUsers(); }
        else { if(msg) msg.textContent = d.message || 'Erreur.'; }
    } catch { if(msg) document.getElementById('admin-pwd-msg').textContent = 'Erreur réseau.'; }
}

function adminSupprimerUser(id, username) {
    document.getElementById('admin-tab-users').innerHTML = `
        <p style="font-size:14px;margin-bottom:16px">Supprimer définitivement <strong>${username}</strong> ?</p>
        <div style="display:flex;gap:8px">
            <button onclick="adminConfirmSupprimer(${id})"
                style="flex:1;padding:10px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">Supprimer</button>
            <button onclick="chargerAdminUsers()"
                style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;cursor:pointer;font-weight:600">Annuler</button>
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
        else alert(d.message);
    } catch { alert('Erreur réseau.'); }
}

async function creerUser() {
    const user     = JSON.parse(localStorage.getItem('myvibe_user'));
    const username = document.getElementById('new-username')?.value?.trim();
    const password = document.getElementById('new-password')?.value?.trim();
    const role     = document.getElementById('new-role')?.value;
    const msg      = document.getElementById('create-msg');
    if (!username || !password) { if(msg) msg.textContent = 'Champs requis.'; return; }
    try {
        const r = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user.userId, username, password, role })
        });
        const d = await r.json();
        if (msg) msg.style.color = d.success ? '#16a34a' : '#dc2626';
        if (msg) msg.textContent = d.success ? `✅ Utilisateur "${username}" créé.` : (d.message || 'Erreur.');
        if (d.success) {
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
        }
    } catch { if(msg) msg.textContent = 'Erreur réseau.'; }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`admin-tab-${tab}`)?.classList.add('active');
    if (tab === 'stats') chargerAdminStats();
    if (tab === 'users') chargerAdminUsers();
}
