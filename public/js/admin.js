// ===================== WIDGET ADMIN =====================

async function chargerWidgetAdmin() {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  if (!user || user.role !== 'admin') return;

  try {
    const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
    const d = await r.json();
    const el = document.getElementById('widget-admin-content');
    if (!el) return;
    if (!d.success) { el.innerHTML = '<p class="wa-error">Erreur de chargement</p>'; return; }
    const s = d.stats;
    el.innerHTML = `
      <div class="wa-stats-row">
        <div class="wa-stat wa-stat-blue">
          <div class="wa-stat-val">${s.totalUsers}</div>
          <div class="wa-stat-lbl">Utilisateurs</div>
        </div>
        <div class="wa-stat wa-stat-purple">
          <div class="wa-stat-val">${s.totalAdmins}</div>
          <div class="wa-stat-lbl">Admins</div>
        </div>
        <div class="wa-stat wa-stat-green">
          <div class="wa-stat-val">${s.totalProfiles}</div>
          <div class="wa-stat-lbl">Profils</div>
        </div>
        <div class="wa-stat wa-stat-orange">
          <div class="wa-stat-val">${s.totalUsers - s.totalProfiles}</div>
          <div class="wa-stat-lbl">Sans profil</div>
        </div>
      </div>
      <div class="wa-activity">
        <div class="wa-activity-title">Dernière activité</div>
        ${s.lastActivity.map(a => `
          <div class="wa-activity-row">
            <div class="wa-avatar">${a.username.charAt(0).toUpperCase()}</div>
            <span class="wa-username">${a.username}</span>
            <span class="wa-badge ${a.role === 'admin' ? 'badge-admin' : 'badge-user'}">${a.role}</span>
            <span class="wa-date">${a.updated_at ? new Date(a.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Jamais'}</span>
          </div>
        `).join('')}
      </div>
      <button class="wa-btn-acces" onclick="ouvrirAdmin()">Panneau d'administration</button>
    `;
  } catch {
    const el = document.getElementById('widget-admin-content');
    if (el) el.innerHTML = '<p class="wa-error">Erreur réseau</p>';
  }
}

// ===================== PANNEAU ADMIN PLEIN ÉCRAN =====================

function ouvrirAdmin() {
  let panel = document.getElementById('admin-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.innerHTML = `
      <div class="ap-sidebar">
        <div class="ap-sidebar-logo">
          <span class="ap-sidebar-icon">&#9881;</span>
          <span>Administration</span>
        </div>
        <nav class="ap-nav">
          <button class="ap-nav-btn active" data-section="overview" onclick="apSwitch('overview', this)">
            <span class="ap-nav-icon">&#9783;</span> Vue d'ensemble
          </button>
          <button class="ap-nav-btn" data-section="users" onclick="apSwitch('users', this)">
            <span class="ap-nav-icon">&#128101;</span> Utilisateurs
          </button>
          <button class="ap-nav-btn" data-section="create" onclick="apSwitch('create', this)">
            <span class="ap-nav-icon">&#43;</span> Créer un compte
          </button>
        </nav>
        <button class="ap-close-btn" onclick="fermerAdmin()">&#8592; Retour</button>
      </div>
      <div class="ap-main">
        <div id="ap-section-overview" class="ap-section active">
          <div class="ap-section-header">
            <h2>Vue d'ensemble</h2>
            <p>Statistiques globales du système</p>
          </div>
          <div id="ap-overview-content"><div class="ap-loading">Chargement...</div></div>
        </div>
        <div id="ap-section-users" class="ap-section">
          <div class="ap-section-header">
            <h2>Utilisateurs</h2>
            <p>Gestion des comptes</p>
          </div>
          <div id="ap-users-content"><div class="ap-loading">Chargement...</div></div>
        </div>
        <div id="ap-section-create" class="ap-section">
          <div class="ap-section-header">
            <h2>Créer un compte</h2>
            <p>Ajouter un nouvel utilisateur</p>
          </div>
          <div class="ap-create-form">
            <div class="ap-field-group">
              <label>Nom d'utilisateur</label>
              <input type="text" id="ap-new-username" placeholder="nom_utilisateur" autocomplete="off">
            </div>
            <div class="ap-field-group">
              <label>Mot de passe</label>
              <input type="password" id="ap-new-password" placeholder="••••••••">
            </div>
            <div class="ap-field-group">
              <label>Rôle</label>
              <select id="ap-new-role">
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <button class="ap-btn-primary" onclick="apCreerUser()">Créer le compte</button>
            <p id="ap-create-msg" class="ap-create-msg"></p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
  apChargerOverview();
}

function fermerAdmin() {
  const panel = document.getElementById('admin-panel');
  if (panel) panel.classList.remove('open');
  document.body.style.overflow = '';
  chargerWidgetAdmin();
}

function apSwitch(section, btn) {
  document.querySelectorAll('.ap-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.ap-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ap-section-' + section).classList.add('active');
  if (section === 'users') apChargerUsers();
  if (section === 'overview') apChargerOverview();
}

async function apChargerOverview() {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const el = document.getElementById('ap-overview-content');
  if (!el) return;
  try {
    const r = await fetch(`/api/admin/stats?adminId=${user.userId}`);
    const d = await r.json();
    if (!d.success) { el.innerHTML = '<p class="ap-error">Erreur de chargement</p>'; return; }
    const s = d.stats;
    el.innerHTML = `
      <div class="ap-cards-grid">
        <div class="ap-card ap-card-blue">
          <div class="ap-card-icon">&#128101;</div>
          <div class="ap-card-val">${s.totalUsers}</div>
          <div class="ap-card-lbl">Utilisateurs</div>
        </div>
        <div class="ap-card ap-card-purple">
          <div class="ap-card-icon">&#9881;</div>
          <div class="ap-card-val">${s.totalAdmins}</div>
          <div class="ap-card-lbl">Administrateurs</div>
        </div>
        <div class="ap-card ap-card-green">
          <div class="ap-card-icon">&#10003;</div>
          <div class="ap-card-val">${s.totalProfiles}</div>
          <div class="ap-card-lbl">Profils remplis</div>
        </div>
        <div class="ap-card ap-card-orange">
          <div class="ap-card-icon">&#9888;</div>
          <div class="ap-card-val">${s.totalUsers - s.totalProfiles}</div>
          <div class="ap-card-lbl">Sans profil</div>
        </div>
      </div>
      <div class="ap-table-section">
        <h3 class="ap-table-title">Activité des comptes</h3>
        <table class="ap-table">
          <thead>
            <tr><th>Compte</th><th>Rôle</th><th>Dernière activité</th></tr>
          </thead>
          <tbody>
            ${s.lastActivity.map(a => `
              <tr>
                <td>
                  <div class="ap-user-cell">
                    <div class="ap-avatar ${a.role === 'admin' ? 'av-admin' : 'av-user'}">${a.username.charAt(0).toUpperCase()}</div>
                    <span>${a.username}</span>
                  </div>
                </td>
                <td><span class="ap-badge ${a.role === 'admin' ? 'badge-admin' : 'badge-user'}">${a.role}</span></td>
                <td class="ap-date-cell">${a.updated_at ? new Date(a.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Jamais'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    el.innerHTML = '<p class="ap-error">Erreur réseau</p>';
  }
}

async function apChargerUsers() {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const el = document.getElementById('ap-users-content');
  if (!el) return;
  el.innerHTML = '<div class="ap-loading">Chargement...</div>';
  try {
    const r = await fetch(`/api/admin/users?adminId=${user.userId}`);
    const d = await r.json();
    if (!d.success) { el.innerHTML = '<p class="ap-error">Erreur de chargement</p>'; return; }
    el.innerHTML = `
      <table class="ap-table ap-users-table">
        <thead>
          <tr><th>Compte</th><th>Rôle</th><th>Profil</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${d.users.map(u => `
            <tr id="ap-urow-${u.id}">
              <td>
                <div class="ap-user-cell">
                  <div class="ap-avatar ${u.role === 'admin' ? 'av-admin' : 'av-user'}">${u.username.charAt(0).toUpperCase()}</div>
                  <div>
                    <div class="ap-uname">${u.username}</div>
                    <div class="ap-uid">#${u.id}</div>
                  </div>
                </div>
              </td>
              <td><span class="ap-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
              <td class="ap-profil-cell">${[u.prenom, u.nom].filter(Boolean).join(' ') || '<em>Aucun</em>'}</td>
              <td>
                <div class="ap-actions-cell">
                  <div class="ap-reset-group">
                    <input type="password" id="ap-mdp-${u.id}" placeholder="Nouveau MDP" class="ap-mdp-input">
                    <button class="ap-action-btn ap-btn-blue" onclick="apResetMdp(${u.id}, this)">Réinit. MDP</button>
                  </div>
                  <button class="ap-action-btn ap-btn-green" onclick="apToggleRole(${u.id}, '${u.role}', this)">
                    ${u.role === 'admin' ? '→ user' : '→ admin'}
                  </button>
                  <button class="ap-action-btn ap-btn-red" onclick="apSupprimerUser(${u.id}, '${u.username}')">Suppr.</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch {
    el.innerHTML = '<p class="ap-error">Erreur réseau</p>';
  }
}

async function apResetMdp(userId, btn) {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const input = document.getElementById('ap-mdp-' + userId);
  const nouveauMdp = input?.value.trim();
  if (!nouveauMdp) {
    _adminModal('Mot de passe requis', `<p style="color:#ef4444;margin-bottom:20px">Entrez un nouveau mot de passe dans le champ.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
    return;
  }
  try {
    const r = await fetch('/api/admin/reset-mdp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.userId, targetUserId: userId, nouveauMdp })
    });
    const d = await r.json();
    if (d.success) {
      input.value = '';
      btn.textContent = 'OK';
      btn.style.background = '#10b981';
      btn.style.color = '#fff';
      setTimeout(() => { btn.textContent = 'Réinit. MDP'; btn.style.background = ''; btn.style.color = ''; }, 2500);
    } else {
      _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">${d.message}</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
    }
  } catch {
    _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">Erreur réseau.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
  }
}

async function apToggleRole(userId, roleActuel, btn) {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const newRole = roleActuel === 'admin' ? 'user' : 'admin';
  _adminModal('Modification du rôle', `
    <p style="color:#333;margin-bottom:20px">Changer ce compte en <strong>"${newRole}"</strong> ?</p>
    <div class="modal-actions">
      <button class="btn-save" id="ap-role-confirm">Confirmer</button>
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
    </div>
  `);
  document.getElementById('ap-role-confirm').onclick = async () => {
    try {
      const r = await fetch('/api/admin/update-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.userId, targetUserId: userId, role: newRole })
      });
      const d = await r.json();
      closeModal();
      if (d.success) apChargerUsers();
      else _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">${d.message}</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
    } catch {
      closeModal();
      _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">Erreur réseau.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
    }
  };
}

async function apSupprimerUser(userId, username) {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  _adminModal('Confirmer la suppression', `
    <p style="color:#333;margin-bottom:20px">Supprimer <strong>"${username}"</strong> ? Action irréversible.</p>
    <div class="modal-actions">
      <button class="btn-delete" id="ap-suppr-confirm">Supprimer</button>
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
    </div>
  `);
  document.getElementById('ap-suppr-confirm').onclick = async () => {
    try {
      const r = await fetch('/api/admin/delete-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.userId, targetUserId: userId })
      });
      const d = await r.json();
      closeModal();
      if (d.success) {
        document.getElementById('ap-urow-' + userId)?.remove();
        apChargerOverview();
      } else {
        _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">${d.message}</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
      }
    } catch {
      closeModal();
      _adminModal('Erreur', `<p style="color:#ef4444;margin-bottom:20px">Erreur réseau.</p><div class="modal-actions"><button class="btn-cancel" onclick="closeModal()">Fermer</button></div>`);
    }
  };
}

async function apCreerUser() {
  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const username = document.getElementById('ap-new-username')?.value.trim();
  const password = document.getElementById('ap-new-password')?.value.trim();
  const role     = document.getElementById('ap-new-role')?.value;
  const msg      = document.getElementById('ap-create-msg');
  if (!username || !password) {
    msg.textContent = 'Remplissez tous les champs.';
    msg.className = 'ap-create-msg ap-msg-error';
    return;
  }
  msg.textContent = 'Création en cours...';
  msg.className = 'ap-create-msg ap-msg-info';
  try {
    const r = await fetch('/api/admin/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: user.userId, username, password, role })
    });
    const d = await r.json();
    if (d.success) {
      msg.textContent = 'Compte créé avec succès.';
      msg.className = 'ap-create-msg ap-msg-success';
      document.getElementById('ap-new-username').value = '';
      document.getElementById('ap-new-password').value = '';
      apChargerOverview();
    } else {
      msg.textContent = d.message || 'Erreur inconnue.';
      msg.className = 'ap-create-msg ap-msg-error';
    }
  } catch {
    msg.textContent = 'Erreur réseau.';
    msg.className = 'ap-create-msg ap-msg-error';
  }
}

function _adminModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('overlay').classList.add('on');
}
