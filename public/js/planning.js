async function chargerWidgetPlanning() {
  const conteneur = document.getElementById('widget-planning-contenu');
  if (!conteneur) return;

  const user = JSON.parse(localStorage.getItem('myvibe_user'));
  const token = user?.token;
  if (!token) return;

  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const mois  = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin',
                 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

  // Construire les 5 dates locales à partir d'aujourd'hui
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    dates.push({ obj: d, str: `${yyyy}-${mm}-${dd}` });
  }

  const SHIFT = {
    'Nuit'    : { emoji: '🌙', couleur: '#f4a261' },
    'R.H.'    : { emoji: '💤', couleur: '#90caf9' },
    'R.C.'    : { emoji: '🟢', couleur: '#a5d6a7' },
    'R.M.'    : { emoji: '💜', couleur: '#ce93d8' },
    'C.A.'    : { emoji: '🏖️', couleur: '#80cbc4' },
    'J.F.'    : { emoji: '🎉', couleur: '#fff176' },
    'F.L.C.'  : { emoji: '🔗', couleur: '#bcaaa4' },
    'Mission' : { emoji: '💼', couleur: '#a5d6a7' },
  };

  // Récupérer les données pour le mois courant (et éventuellement le suivant)
  const now = new Date();
  const annee = now.getFullYear();
  const moisCourant = now.getMonth() + 1;

  let entries = [];
  try {
    const res = await fetch(`/api/planning?annee=${annee}&mois=${moisCourant}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    entries = Array.isArray(data) ? data : [];

    // Si on chevauche le mois suivant
    const dernierJour = dates[dates.length - 1].obj;
    if (dernierJour.getMonth() + 1 !== moisCourant) {
      const moisSuivant = dernierJour.getMonth() + 1;
      const res2 = await fetch(`/api/planning?annee=${annee}&mois=${moisSuivant}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data2 = await res2.json();
      if (Array.isArray(data2)) entries = entries.concat(data2);
    }
  } catch (e) {
    conteneur.innerHTML = '<p style="color:#999;font-size:13px;">Erreur de chargement</p>';
    return;
  }

  // Indexer par date string
  const map = {};
  entries.forEach(e => {
    const raw = e.date?.slice(0, 10); // déjà YYYY-MM-DD si stocké en DATE
if (raw && !map[raw]) map[raw] = e; // première entrée du jour
  });

  // Construire le HTML
  let html = '';
  dates.forEach(({ obj, str }, i) => {
    const entry  = map[str];
    const nomJour = jours[obj.getDay()];
    const numJour = obj.getDate();
    const nomMois = mois[obj.getMonth()];
    const label   = i === 0 ? "Aujourd'hui" : `${nomJour} ${numJour} ${nomMois}`;

    if (entry) {
      const shift = SHIFT[entry.type] || { emoji: '📋', couleur: '#eee' };
      html += `
        <div style="
          display:flex; align-items:center; gap:10px;
          padding:8px 10px; margin-bottom:6px;
          background:${shift.couleur}22;
          border-left:4px solid ${shift.couleur};
          border-radius:8px;
        ">
          <span style="font-size:20px;">${shift.emoji}</span>
          <div>
            <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
            <div style="font-size:14px;font-weight:700;color:#333;">${entry.type}</div>
            ${entry.heure_debut ? `<div style="font-size:12px;color:#666;">⏰ ${entry.heure_debut.slice(0,5)} → ${entry.heure_fin?.slice(0,5) || '?'}</div>` : ''}
            ${entry.employeur   ? `<div style="font-size:11px;color:#999;">🏥 ${entry.employeur}</div>` : ''}
          </div>
        </div>`;
    } else {
      html += `
        <div style="
          display:flex; align-items:center; gap:10px;
          padding:8px 10px; margin-bottom:6px;
          background:#f9f9f9; border-left:4px solid #ddd;
          border-radius:8px;
        ">
          <span style="font-size:20px;">📅</span>
          <div>
            <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
            <div style="font-size:13px;color:#bbb;">Aucune entrée</div>
          </div>
        </div>`;
    }
  });

  html += `<div style="text-align:center;margin-top:6px;">
    <span onclick="ouvrirPlanningModal()" style="font-size:12px;color:#6c63ff;cursor:pointer;">
      Cliquez pour voir le planning
    </span>
  </div>`;

  conteneur.innerHTML = html;
}
