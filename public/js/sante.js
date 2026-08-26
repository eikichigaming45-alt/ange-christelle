// ============================================================
// public/js/sante.js
// Widget Santé — onglet Sport.
// Calculs locaux : IMC, BMR (Mifflin-St Jeor), TDEE, macros,
// kcal objectif. Affichage instantané depuis profilCache.
// Groq : 1 appel/jour max — cache localStorage
// clé : sante_plan_YYYY-MM-DD_<userId>
// Pas de modale — tout est inline dans le widget.
// Dépend de : app.js (getUser, profilCache)
// ============================================================

// ===================== CALCULS LOCAUX ========================

function _imc(poids, taille) {
    if (!poids || !taille) return null;
    return (poids / Math.pow(taille / 100, 2)).toFixed(1);
}

function _imcCategorie(imc) {
    if (!imc) return null;
    const v = parseFloat(imc);
    if (v < 18.5) return { label: 'Insuffisance pondérale', color: '#3b82f6' };
    if (v < 25)   return { label: 'Poids normal',           color: '#10b981' };
    if (v < 30)   return { label: 'Surpoids',               color: '#f59e0b' };
    return             { label: 'Obésité',                  color: '#ef4444' };
}

function _bmr(poids, taille, age, sexe) {
    if (!poids || !taille || !age || !sexe) return null;
    if (sexe === 'homme') return 10 * poids + 6.25 * taille - 5 * age + 5;
    return 10 * poids + 6.25 * taille - 5 * age - 161;
}

function _tdee(bmr, niveau_activite) {
    if (!bmr) return null;
    const coeffs = {
        sedentaire : 1.2,
        leger      : 1.375,
        modere     : 1.55,
        actif      : 1.725,
        tres_actif : 1.9
    };
    return Math.round(bmr * (coeffs[niveau_activite] || 1.2));
}

function _kcalObjectif(tdee, objectif_sante) {
    if (!tdee || !objectif_sante) return null;
    const deltas = {
        perte_moderee     : -300,
        perte_rapide      : -500,
        maintien          :    0,
        prise_masse       :  300,
        prise_masse_rapide:  500
    };
    const delta = deltas[objectif_sante];
    if (delta === undefined) return null;
    return tdee + delta;
}

function _macros(kcal, objectif_sante) {
    if (!kcal) return null;
    // Répartition selon objectif : proteines / glucides / lipides
    const ratios = {
        perte_moderee     : { p: 0.35, g: 0.40, l: 0.25 },
        perte_rapide      : { p: 0.40, g: 0.35, l: 0.25 },
        maintien          : { p: 0.30, g: 0.45, l: 0.25 },
        prise_masse       : { p: 0.30, g: 0.45, l: 0.25 },
        prise_masse_rapide: { p: 0.30, g: 0.45, l: 0.25 }
    };
    const r = ratios[objectif_sante] || ratios['maintien'];
    return {
        proteines: Math.round((kcal * r.p) / 4),
        glucides  : Math.round((kcal * r.g) / 4),
        lipides   : Math.round((kcal * r.l) / 9)
    };
}

function _age(date_naissance) {
    if (!date_naissance) return null;
    const n     = new Date(date_naissance);
    const today = new Date();
    let a       = today.getFullYear() - n.getFullYear();
    if (today < new Date(today.getFullYear(), n.getMonth(), n.getDate())) a--;
    return a;
}

// ===================== CACHE GROQ ============================

function _cacheKey(userId) {
    const today = new Date().toISOString().split('T')[0];
    return `sante_plan_${today}_${userId}`;
}

function _lireCache(userId) {
    try {
        const raw = localStorage.getItem(_cacheKey(userId));
        if (!raw) return null;
        const data = JSON.parse(raw);
        // Vérification que la date correspond bien à aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        if (data.date !== today) return null;
        return data;
    } catch { return null; }
}

function _ecrireCache(userId, plan, calories_cibles) {
    try {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(_cacheKey(userId), JSON.stringify({
            date: today,
            plan,
            calories_cibles
        }));
    } catch { /* silencieux */ }
}

// ===================== RENDU WIDGET ==========================

async function chargerWidgetSante() {
    const el = document.getElementById('wc-sante');
    if (!el) return;

    const user = getUser();
    if (!user?.token) {
        el.innerHTML = '<p class="rdv-empty">Non connecté</p>';
        return;
    }

    // Utiliser profilCache si dispo, sinon fetch
    let p = profilCache;
    if (!p) {
        try {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (d.success && d.profil) { p = d.profil; profilCache = p; }
        } catch {}
    }

    if (!p) {
        el.innerHTML = '<p class="rdv-error">Erreur de chargement du profil</p>';
        return;
    }

    // ── Calculs locaux ────────────────────────────────────────
    const age      = _age(p.date_naissance);
    const imc      = _imc(p.poids, p.taille);
    const imcCat   = _imcCategorie(imc);
    const bmr      = _bmr(p.poids, p.taille, age, p.sexe);
    const tdee     = _tdee(bmr, p.niveau_activite);
    const kcal     = _kcalObjectif(tdee, p.objectif_sante);
    const macros   = _macros(kcal, p.objectif_sante);

    const profilComplet = p.taille && p.poids && p.sexe && p.date_naissance && p.niveau_activite && p.objectif_sante;

    // ── HTML calculs ──────────────────────────────────────────
    const htmlCalculs = `
        <div class="sante-calculs">
            <div class="sante-calcul-row">
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">IMC</div>
                    <div class="sante-calcul-val" style="color:${imcCat?.color || '#9ca3af'}">
                        ${imc || '—'}
                    </div>
                    <div class="sante-calcul-sub" style="color:${imcCat?.color || '#9ca3af'}">
                        ${imcCat?.label || 'Profil incomplet'}
                    </div>
                </div>
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">TDEE</div>
                    <div class="sante-calcul-val" style="color:#7c3aed">
                        ${tdee ? tdee + ' kcal' : '—'}
                    </div>
                    <div class="sante-calcul-sub">Maintien / jour</div>
                </div>
                <div class="sante-calcul-bloc">
                    <div class="sante-calcul-label">Objectif</div>
                    <div class="sante-calcul-val" style="color:#10b981">
                        ${kcal ? kcal + ' kcal' : '—'}
                    </div>
                    <div class="sante-calcul-sub">/ jour</div>
                </div>
            </div>
            ${macros ? `
            <div class="sante-macros">
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Protéines</span>
                    <span class="sante-macro-val">${macros.proteines} g</span>
                </div>
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Glucides</span>
                    <span class="sante-macro-val">${macros.glucides} g</span>
                </div>
                <div class="sante-macro-item">
                    <span class="sante-macro-label">Lipides</span>
                    <span class="sante-macro-val">${macros.lipides} g</span>
                </div>
            </div>` : ''}
        </div>
    `;

    // ── Vérification cache Groq ───────────────────────────────
    const cached = _lireCache(user.userId);

    const htmlPlan = cached
        ? _renderPlan(cached.plan, cached.calories_cibles)
        : '<div id="sante-plan-zone"></div>';

    const btnLabel = cached ? '🔄 Plan généré aujourd\'hui' : '✨ Générer mon plan du jour';
    const btnDisabled = cached ? 'disabled style="opacity:.6;cursor:not-allowed"' : '';

    el.innerHTML = `
        ${!profilComplet ? `
        <div class="sante-alerte">
            ⚠️ Complète ton profil Santé pour activer tous les calculs.
        </div>` : ''}
        ${htmlCalculs}
        <div id="sante-plan-zone">
            ${cached ? _renderPlan(cached.plan, cached.calories_cibles) : ''}
        </div>
        ${profilComplet ? `
        <button id="btn-sante-groq" onclick="genererPlanSante()" ${btnDisabled}
            class="sante-btn-groq">
            ${btnLabel}
        </button>
        <div id="sante-groq-msg" style="font-size:12px;color:#9ca3af;text-align:center;margin-top:6px;min-height:16px"></div>
        ` : ''}
    `;
}

// ===================== RENDU PLAN GROQ =======================

function _renderPlan(plan, calories_cibles) {
    if (!plan) return '';
    return `
        <div class="sante-plan">
            <div class="sante-plan-titre">🥗 Plan du jour — ${calories_cibles ? calories_cibles + ' kcal cibles' : ''}</div>
            <div class="sante-plan-section">🌅 Petit-déjeuner</div>
            <div class="sante-plan-contenu">${plan.repas?.petit_dejeuner || '—'}</div>
            <div class="sante-plan-section">🍎 Collation matin</div>
            <div class="sante-plan-contenu">${plan.repas?.collation_matin || '—'}</div>
            <div class="sante-plan-section">🍽️ Déjeuner</div>
            <div class="sante-plan-contenu">${plan.repas?.dejeuner || '—'}</div>
            <div class="sante-plan-section">🍊 Collation soir</div>
            <div class="sante-plan-contenu">${plan.repas?.collation_soir || '—'}</div>
            <div class="sante-plan-section">🌙 Dîner</div>
            <div class="sante-plan-contenu">${plan.repas?.diner || '—'}</div>
            ${plan.activites?.length ? `
            <div class="sante-plan-section">🏃 Activités recommandées</div>
            <div class="sante-plan-contenu">${plan.activites.join('<br>')}</div>
            ` : ''}
            ${plan.conseil_du_jour ? `
            <div class="sante-plan-section">💡 Conseil du jour</div>
            <div class="sante-plan-contenu">${plan.conseil_du_jour}</div>
            ` : ''}
        </div>
    `;
}

// ===================== APPEL GROQ ============================

async function genererPlanSante() {
    const user = getUser();
    if (!user?.token) return;

    // Vérification cache — sécurité supplémentaire côté client
    const cached = _lireCache(user.userId);
    if (cached) return;

    const btn = document.getElementById('btn-sante-groq');
    const msg = document.getElementById('sante-groq-msg');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Génération en cours...'; }
    if (msg) { msg.textContent = ''; }

    try {
        const r = await fetch('/api/sante/plan', {
            method  : 'POST',
            headers : { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();

        if (d.plan) {
            _ecrireCache(user.userId, d.plan, d.calories_cibles);
            const zone = document.getElementById('sante-plan-zone');
            if (zone) zone.innerHTML = _renderPlan(d.plan, d.calories_cibles);
            if (btn) {
                btn.textContent = '🔄 Plan généré aujourd\'hui';
                btn.disabled    = true;
                btn.style.opacity = '0.6';
                btn.style.cursor  = 'not-allowed';
            }
        } else {
            if (msg) msg.textContent = '❌ ' + (d.error || 'Erreur lors de la génération.');
            if (btn) { btn.disabled = false; btn.textContent = '✨ Générer mon plan du jour'; }
        }
    } catch {
        if (msg) msg.textContent = '❌ Erreur réseau.';
        if (btn) { btn.disabled = false; btn.textContent = '✨ Générer mon plan du jour'; }
    }
}
