// ===================== ADMINISTRATION =====================

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(t=>t.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`admin-tab-${tab}`).classList.add('active');
}

async function chargerAdminStats() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;
    const s = d.stats;
    document.getElementById('admin-tab-stats').innerHTML = `
        <div class="stat-grid">
            <div class="stat-card"><div class="val">${s.totalUsers}</div><div class="lbl">Utilisateurs</div></div>
            <div class="stat-card"><div class="val">${s.totalAdmins}</div><div class="lbl">Admins</div></div>
            <div class="stat-card"><div class="val">${s.totalProfiles}</div><div class="lbl">Profils remplis</div></div>
            <div class="stat-card"><div class="val">${s.totalUsers-s.totalProfiles}</div><div class="lbl">Sans profil</div></div>
        </div>
        <h4 style="color:#333;margin-bottom:10px;font-size:14px">Dernière activité</h4>
        ${s.lastActivity.map(a=>`
             <div class="activity-row">
                <span class="u">${a.username}</span>
                <span class="d">${a.updated_at ? new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : 'Jamais'}</span>
            </div>
        `).join('')}
    `;
}

async function chargerAdminUsers() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const r = await fetch(`/api/admin/users?adminId=${user.userId}`);
    const d = await r.json();
    if (!d.success) return;
    document.getElementById('admin-tab-users').innerHTML = d.users.map(u => `
        <div class="user-card" id="ucard-${u.id}">
            <div class="user-card-header">
                <div>
                    <span class="user-card-name">${u.username}</span>
                    <span class="user-card-role ${u.role==='admin'?'role-admin':'role-user'}">${u.role}</span>
                </div>
                <span style="font-size:11px;color:#9ca3af">#${u.id}</span>
            </div>
            <div class="user-card-meta">
                ${[u.prenom,u.nom].filter(Boolean).join(' ')||'<em>Pas de profil</em>'}
                ${u.email?' · '+u.email:''}
                ${u.profession?' · '+u.profession:''}
            </div>
            <div class="user-card-actions">
                <input type="password" id="reset-mdp-${u.id}" placeholder="Nouveau mot de passe">
                <button class="ua-btn ua-btn-blue" onclick="resetMdpUser(${u.id},this)">🔑 MDP</button>
                <button class="ua-btn ua-btn-green" onclick="toggleRole(${u.id},'${u.role}',this)">
                    ${u.role==='admin'?'👤 → user':'⚙️ → admin'}
                </button>
                <button class="ua-btn ua-btn-red" onclick="supprimerUser(${u.id},'${u.username}')">🗑️ Suppr.</button>
            </div>
        </div>
    `).join('');
}

async function resetMdpUser(userId, btn) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const input = document.getElementById('reset-mdp-'+userId);
    const nouveauMdp = input.value.trim();
    if (!nouveauMdp) { alert('Entrez un nouveau mot de passe'); return; }
    try {
        const r = await fetch('/api/admin/reset-mdp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:user.userId,targetUserId:userId,nouveauMdp})});
        const d = await r.json();
        if (d.success) { input.value=''; btn.textContent='✅'; setTimeout(()=>btn.textContent='🔑 MDP',2000); }
        else alert('Erreur : '+d.message);
    } catch { alert('Erreur réseau'); }
}

async function toggleRole(userId, roleActuel, btn) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const newRole = roleActuel==='admin'?'user':'admin';
    
    confirmerAction(`Changer ce compte en "${newRole}" ?`, async () => {
        try {
            const r = await fetch('/api/admin/update-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:user.userId,targetUserId:userId,role:newRole})});
            const d = await r.json();
            if (d.success) chargerAdminUsers();
            else alert('Erreur : '+d.message);
        } catch { alert('Erreur réseau'); }
    });
}

async function supprimerUser(userId, username) {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    
    confirmerAction(`Supprimer définitivement "${username}" ? Cette action est irréversible.`, async () => {
        try {
            const r = await fetch('/api/admin/delete-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:user.userId,targetUserId:userId})});
            const d = await r.json();
            if (d.success) { document.getElementById('ucard-'+userId)?.remove(); chargerAdminStats(); }
            else alert('Erreur : '+d.message);
        } catch { alert('Erreur réseau'); }
    });
}

async function creerUser() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const role     = document.getElementById('new-role').value;
    const msg      = document.getElementById('create-msg');
    if (!username||!password) { msg.textContent='Remplissez tous les champs'; msg.style.color='#ef4444'; return; }
    msg.textContent='Création...'; msg.style.color='#9ca3af';
    try {
        const r = await fetch('/api/admin/create-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:user.userId,username,password,role})});
        const d = await r.json();
        if (d.success) {
            msg.textContent='✅ Utilisateur créé !'; msg.style.color='#10b981';
            document.getElementById('new-username').value='';
            document.getElementById('new-password').value='';
            chargerAdminUsers();
            chargerAdminStats();
        } else { msg.textContent='❌ '+d.message; msg.style.color='#ef4444'; }
    } catch { msg.textContent='❌ Erreur réseau'; msg.style.color='#ef4444'; }
}
