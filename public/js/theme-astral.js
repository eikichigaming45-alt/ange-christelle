// ============================================================
// public/js/theme-astral.js
// Thème Astral — widget grille + modale + roue natale SVG
// ============================================================

// ── Mappings FR ───────────────────────────────────────────────
const TA_PLANETES_FR = {
    Sun      : 'Soleil',
    Moon     : 'Lune',
    Mercury  : 'Mercure',
    Venus    : 'Vénus',
    Mars     : 'Mars',
    Jupiter  : 'Jupiter',
    Saturn   : 'Saturne',
    Uranus   : 'Uranus',
    Neptune  : 'Neptune',
    Pluto    : 'Pluton',
    Ascendant: 'Ascendant',
    MC       : 'Milieu du Ciel',
    NorthNode: 'Nœud Nord',
    Chiron   : 'Chiron',
    Lilith   : 'Lilith'
};

const TA_SIGNES_FR = {
    Aries      : 'Bélier',
    Taurus     : 'Taureau',
    Gemini     : 'Gémeaux',
    Cancer     : 'Cancer',
    Leo        : 'Lion',
    Virgo      : 'Vierge',
    Libra      : 'Balance',
    Scorpio    : 'Scorpion',
    Sagittarius: 'Sagittaire',
    Capricorn  : 'Capricorne',
    Aquarius   : 'Verseau',
    Pisces     : 'Poissons'
};

const TA_SIGNES_EMOJI = {
    Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋',
    Leo:'♌', Virgo:'♍', Libra:'♎', Scorpio:'♏',
    Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓'
};

const TA_PLANETES_SYMBOLES = {
    Sun      : '☉',
    Moon     : '☽',
    Mercury  : '☿',
    Venus    : '♀',
    Mars     : '♂',
    Jupiter  : '♃',
    Saturn   : '♄',
    Uranus   : '♅',
    Neptune  : '♆',
    Pluto    : '♇',
    Ascendant: 'Asc',
    MC       : 'MC',
    NorthNode: '☊',
    Chiron   : '⚷',
    Lilith   : '⚸'
};

const TA_SIGNES_ORDRE = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

// ── Cache local session ───────────────────────────────────────
let _taCache = null;

// ===================== WIDGET ================================

async function chargerThemeAstral() {
    const wc = document.getElementById('wc-theme-astral');
    if (!wc) return;

    wc.innerHTML = `<div class="ta-loader"><div class="ta-spinner"></div></div>`;

    const user = getUser();
    if (!user?.token) return;

    try {
        const r = await fetch('/api/theme-astral', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const d = await r.json();

        if (!d.success) {
            wc.innerHTML = _taWidgetErreur(d.code);
            return;
        }

        _taCache = d.data;
        wc.innerHTML = _taWidgetContenu(d.data);

    } catch {
        wc.innerHTML = `
            <div class="ta-banner ta-banner-error">
                <span class="ta-banner-icon">⚠️</span>
                <span>Erreur réseau — réessayez plus tard.</span>
            </div>`;
    }
}

function _taWidgetErreur(code) {
    if (code === 'NO_DATE') {
        return `
            <div class="ta-banner ta-banner-error">
                <div>
                    <span class="ta-banner-icon">📅</span>
                    <strong>Date de naissance manquante.</strong><br>
                    Ajoutez votre date de naissance dans votre profil pour calculer votre thème natal.
                    <br><button class="ta-banner-btn" onclick="ouvrirMonProfil()">Compléter le profil</button>
                </div>
            </div>`;
    }
    if (code === 'NO_LOCATION') {
        return `
            <div class="ta-banner ta-banner-error">
                <div>
                    <span class="ta-banner-icon">📍</span>
                    <strong>Lieu de naissance manquant.</strong><br>
                    Ajoutez votre lieu de naissance dans votre profil pour calculer l'Ascendant et les maisons.
                    <br><button class="ta-banner-btn" onclick="ouvrirMonProfil()">Compléter le profil</button>
                </div>
            </div>`;
    }
    if (code === 'NO_PROFILE') {
        return `
            <div class="ta-banner ta-banner-error">
                <div>
                    <span class="ta-banner-icon">👤</span>
                    <strong>Profil introuvable.</strong><br>
                    Complétez votre profil pour accéder au thème astral.
                    <br><button class="ta-banner-btn" onclick="ouvrirMonProfil()">Compléter le profil</button>
                </div>
            </div>`;
    }
    if (code === 'API_ERROR') {
        return `
            <div class="ta-banner ta-banner-warn">
                <div>
                    <span class="ta-banner-icon">🔮</span>
                    <strong>Service temporairement indisponible.</strong><br>
                    Le calcul astral sera disponible dans quelques instants.
                </div>
            </div>`;
    }
    return `
        <div class="ta-banner ta-banner-error">
            <span class="ta-banner-icon">⚠️</span>
            <span>Erreur inattendue.</span>
        </div>`;
}

function _taWidgetContenu(data) {
    const soleil    = data.soleil;
    const ascendant = data.ascendant;
    const dominante = data.dominanteFR;

    const soleilHtml = soleil ? `
        <div class="ta-widget-row">
            <span class="ta-widget-label">Soleil</span>
            <span class="ta-widget-badge">
                <span class="ta-emoji">${TA_SIGNES_EMOJI[soleil.sign] || '✨'}</span>
                ${soleil.signeFR || soleil.sign}
            </span>
        </div>` : '';

    const ascHtml = ascendant ? `
        <div class="ta-widget-row">
            <span class="ta-widget-label">Ascendant</span>
            <span class="ta-widget-badge">
                <span class="ta-emoji">${TA_SIGNES_EMOJI[ascendant.sign] || '✨'}</span>
                ${ascendant.signeFR || ascendant.sign}
            </span>
        </div>` : `
        <div class="ta-banner ta-banner-warn" style="margin-top:6px">
            <span class="ta-banner-icon">⏰</span>
            <span style="font-size:12px">Ajoutez votre <strong>heure de naissance</strong> pour obtenir l'Ascendant et les maisons.</span>
        </div>`;

    const domHtml = dominante ? `
        <div class="ta-widget-dominante">
            <span class="ta-widget-dominante-label">Dominante</span>
            <span class="ta-widget-dominante-val">${dominante}</span>
        </div>` : '';

    return `${soleilHtml}${ascHtml}${domHtml}`;
}

// ===================== MODALE ================================

async function ouvrirModaleThemeAstral() {
    const body = document.getElementById('modal-body');
    body.innerHTML = `<div class="ta-loader"><div class="ta-spinner"></div><span>Calcul du thème natal...</span></div>`;

    const user = getUser();
    if (!user?.token) {
        body.innerHTML = '<p style="color:#ef4444">Utilisateur non identifié.</p>';
        return;
    }

    try {
        // Réutiliser le cache session si disponible
        let data = _taCache;
        if (!data) {
            const r = await fetch('/api/theme-astral', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (!d.success) {
                body.innerHTML = _taModaleErreur(d.code);
                return;
            }
            _taCache = d.data;
            data     = d.data;
        }

        body.innerHTML = _taModaleContenu(data);

    } catch {
        body.innerHTML = `
            <div class="ta-banner ta-banner-error">
                <span class="ta-banner-icon">⚠️</span>
                <span>Erreur réseau — réessayez plus tard.</span>
            </div>`;
    }
}

function _taModaleErreur(code) {
    const messages = {
        NO_DATE    : { icon:'📅', titre:'Date de naissance manquante',  texte:'Ajoutez votre date de naissance dans l\'onglet Profil pour calculer votre thème natal.' },
        NO_LOCATION: { icon:'📍', titre:'Lieu de naissance manquant',   texte:'Ajoutez votre lieu de naissance dans l\'onglet Profil pour calculer l\'Ascendant et les maisons.' },
        NO_PROFILE : { icon:'👤', titre:'Profil incomplet',             texte:'Complétez votre profil pour accéder au thème astral.' },
        API_ERROR  : { icon:'🔮', titre:'Service indisponible',         texte:'Le service de calcul astral est temporairement indisponible. Réessayez dans quelques instants.' }
    };
    const m = messages[code] || { icon:'⚠️', titre:'Erreur', texte:'Une erreur inattendue s\'est produite.' };
    const isError = code !== 'API_ERROR';
    return `
        <div class="ta-banner ${isError ? 'ta-banner-error' : 'ta-banner-warn'}" style="margin-bottom:20px">
            <span class="ta-banner-icon">${m.icon}</span>
            <div>
                <strong>${m.titre}</strong><br>
                ${m.texte}
                ${isError ? `<br><button class="ta-banner-btn" onclick="closeModal();ouvrirMonProfil()">Compléter le profil</button>` : ''}
            </div>
        </div>`;
}

function _taModaleContenu(data) {
    const { soleil, lune, ascendant, mc, dominanteFR, planetes, interpretation, hasHeure, generatedAt } = data;

    // ── Bannière heure manquante ──────────────────────────────
    const banniereHeure = !hasHeure ? `
        <div class="ta-banner ta-banner-warn" style="margin-bottom:16px">
            <span class="ta-banner-icon">⏰</span>
            <div>
                <strong>Heure de naissance non renseignée.</strong><br>
                L'Ascendant, le Milieu du Ciel et les maisons ne peuvent pas être calculés.
                Les planètes sont positionnées à midi (heure locale).
                <br><button class="ta-banner-btn" onclick="closeModal();ouvrirMonProfil()">Ajouter l'heure</button>
            </div>
        </div>` : '';

    // ── Cards résumé ──────────────────────────────────────────
    const cardsHtml = `
        <div class="ta-cards-grid">
            ${_taCard('Soleil', soleil)}
            ${_taCard('Lune', lune)}
            ${_taCard('Ascendant', ascendant)}
            ${_taCard('Milieu du Ciel', mc)}
        </div>`;

    // ── Dominante ─────────────────────────────────────────────
    const dominanteHtml = dominanteFR ? `
        <div class="ta-widget-dominante" style="margin-bottom:20px">
            <span class="ta-widget-dominante-label">Dominante planétaire</span>
            <span class="ta-widget-dominante-val">${dominanteFR}</span>
        </div>` : '';

    // ── Roue SVG ──────────────────────────────────────────────
    const roueHtml = `
        <div class="ta-section-title">Roue natale</div>
        <div class="ta-roue-wrap">
            ${_taGenererRoue(planetes, ascendant)}
        </div>`;

    // ── Interprétation Groq ───────────────────────────────────
    const interpHtml = interpretation ? `
        <div class="ta-interp-wrap">
            <div class="ta-interp-title">🔮 Interprétation de votre thème natal</div>
            <div class="ta-interp-text">${_taFormatInterp(interpretation)}</div>
        </div>` : '';

    // ── Tableau planètes ──────────────────────────────────────
    const planetesAffichees = (planetes || []).filter(p =>
        ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'].includes(p.name)
    );

    const tableauHtml = `
        <div class="ta-section-title">Positions planétaires</div>
        <table class="ta-table">
            <thead>
                <tr>
                    <th>Planète</th>
                    <th>Signe</th>
                    <th>Degré</th>
                    ${hasHeure ? '<th>Maison</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${planetesAffichees.map(p => `
                    <tr>
                        <td>${TA_PLANETES_SYMBOLES[p.name] || ''} ${p.nameFR || p.name}</td>
                        <td>${p.emoji || ''} ${p.signeFR || p.sign}</td>
                        <td>${p.normDegree ? parseFloat(p.normDegree).toFixed(1) + '°' : '—'}${p.isRetro === 'true' || p.isRetro === true ? '<span class="ta-retro">R</span>' : ''}</td>
                        ${hasHeure ? `<td>${p.house ? 'Maison ' + p.house : '—'}</td>` : ''}
                    </tr>`).join('')}
            </tbody>
        </table>`;

    // ── Info cache ────────────────────────────────────────────
    const cacheHtml = `
        <div class="ta-cache-info">
            Thème calculé le ${generatedAt || 'aujourd\'hui'} · Mis à jour chaque jour
        </div>`;

    return `${banniereHeure}${cardsHtml}${dominanteHtml}${roueHtml}${interpHtml}${tableauHtml}${cacheHtml}`;
}

function _taCard(label, planete) {
    if (!planete) {
        return `
            <div class="ta-card ta-card-absent">
                <div class="ta-card-label">${label}</div>
                <div class="ta-card-value">—</div>
                <div class="ta-card-sub">Heure requise</div>
            </div>`;
    }
    const deg = planete.normDegree ? parseFloat(planete.normDegree).toFixed(1) + '°' : '';
    return `
        <div class="ta-card">
            <div class="ta-card-label">${label}</div>
            <div class="ta-card-value">
                <span>${planete.emoji || TA_SIGNES_EMOJI[planete.sign] || ''}</span>
                ${planete.signeFR || planete.sign}
            </div>
            ${deg ? `<div class="ta-card-sub">${deg}</div>` : ''}
        </div>`;
}

// ── Formatage interprétation Groq (bold markdown → HTML) ─────
function _taFormatInterp(texte) {
    return texte
        .replace(/\*\*(.+?)\*\*/g, '<strong>\$1</strong>')
        .replace(/\n/g, '<br>');
}

// ===================== ROUE NATALE SVG =======================

function _taGenererRoue(planetes, ascendant) {
    if (!planetes || !planetes.length) {
        return '<text x="150" y="155" text-anchor="middle" fill="#9ca3af" font-size="12">Données insuffisantes</text>';
    }

    const CX = 150, CY = 150, R = 130;
    const R_SIGNES   = 130;
    const R_INNER    = 95;
    const R_PLANETE  = 75;

    // Décalage angulaire : si Ascendant connu, il est à gauche (180°)
    // Sinon, Aries commence à 0° en haut
    let offsetDeg = 0;
    if (ascendant && ascendant.fullDegree != null) {
        offsetDeg = parseFloat(ascendant.fullDegree) - 180;
    }

    function degToRad(deg) {
        return (deg - 90) * Math.PI / 180;
    }

    function eclipToSVG(eclipDeg, r) {
        const angle = degToRad(eclipDeg - offsetDeg);
        return {
            x: CX + r * Math.cos(angle),
            y: CY + r * Math.sin(angle)
        };
    }

    let svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">`;

    // Fond
    svg += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="#0f0c29" stroke="#312e81" stroke-width="1.5"/>`;
    svg += `<circle cx="${CX}" cy="${CY}" r="${R_INNER}" fill="#1e1b4b" stroke="#4338ca" stroke-width="1"/>`;
    svg += `<circle cx="${CX}" cy="${CY}" r="55" fill="#12105a" stroke="#4338ca" stroke-width="0.5"/>`;

    // ── 12 secteurs signes ────────────────────────────────────
    const COULEURS_ELEMENTS = {
        Aries:'#ef4444', Taurus:'#10b981', Gemini:'#f59e0b', Cancer:'#60a5fa',
        Leo:'#ef4444', Virgo:'#10b981', Libra:'#f59e0b', Scorpio:'#60a5fa',
        Sagittarius:'#ef4444', Capricorn:'#10b981', Aquarius:'#f59e0b', Pisces:'#60a5fa'
    };

    TA_SIGNES_ORDRE.forEach((signe, i) => {
        const startDeg = i * 30 - offsetDeg;
        const endDeg   = startDeg + 30;
        const startRad = degToRad(startDeg + offsetDeg);
        const endRad   = degToRad(endDeg + offsetDeg);
        const x1 = CX + R_SIGNES * Math.cos(startRad);
        const y1 = CY + R_SIGNES * Math.sin(startRad);
        const x2 = CX + R_SIGNES * Math.cos(endRad);
        const y2 = CY + R_SIGNES * Math.sin(endRad);
        const xi1 = CX + R_INNER * Math.cos(startRad);
        const yi1 = CY + R_INNER * Math.sin(startRad);
        const couleur = COULEURS_ELEMENTS[signe] || '#6366f1';

        // Ligne de séparation secteur
        svg += `<line x1="${xi1.toFixed(1)}" y1="${yi1.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#4338ca" stroke-width="0.5" opacity="0.6"/>`;

        // Emoji signe au milieu du secteur
        const midRad = degToRad(startDeg + offsetDeg + 15);
        const mx = CX + (R_INNER + (R_SIGNES - R_INNER) / 2) * Math.cos(midRad);
        const my = CY + (R_INNER + (R_SIGNES - R_INNER) / 2) * Math.sin(midRad);
        const emoji = TA_SIGNES_EMOJI[signe] || '';
        svg += `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9" fill="${couleur}">${emoji}</text>`;
    });

    // ── Planètes ──────────────────────────────────────────────
    const PLANETES_AFFICHEES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Ascendant','MC'];
    const planetesRoue = (planetes || []).filter(p => PLANETES_AFFICHEES.includes(p.name) && p.fullDegree != null);

    // Anti-collision : décaler les planètes proches
    const positions = [];
    planetesRoue.forEach(p => {
        let deg = parseFloat(p.fullDegree);
        // Vérifier collision avec positions déjà placées
        let tentatives = 0;
        while (positions.some(pos => Math.abs(pos - deg) < 8 || Math.abs(pos - deg) > 352) && tentatives < 12) {
            deg += 8;
            tentatives++;
        }
        positions.push(deg);

        const pos = eclipToSVG(deg, R_PLANETE);
        const symbole = TA_PLANETES_SYMBOLES[p.name] || p.name.slice(0, 2);
        const couleur = (p.name === 'Sun') ? '#fbbf24'
            : (p.name === 'Moon')          ? '#e0e7ff'
            : (p.name === 'Ascendant')     ? '#34d399'
            : (p.name === 'MC')            ? '#f472b6'
            : '#a5b4fc';

        svg += `<circle cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="9" fill="#1e1b4b" stroke="${couleur}" stroke-width="1.2"/>`;
        svg += `<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="7" fill="${couleur}" font-weight="bold">${symbole}</text>`;
    });

    // ── Axes Asc/Desc et MC/IC ────────────────────────────────
    if (ascendant) {
        const aPos  = eclipToSVG(parseFloat(ascendant.fullDegree), R_INNER - 2);
        const dPos  = eclipToSVG(parseFloat(ascendant.fullDegree) + 180, R_INNER - 2);
        svg += `<line x1="${aPos.x.toFixed(1)}" y1="${aPos.y.toFixed(1)}" x2="${dPos.x.toFixed(1)}" y2="${dPos.y.toFixed(1)}" stroke="#34d399" stroke-width="0.8" opacity="0.6"/>`;
        svg += `<text x="${aPos.x.toFixed(1)}" y="${(aPos.y - 10).toFixed(1)}" text-anchor="middle" font-size="7" fill="#34d399" font-weight="bold">Asc</text>`;
    }

    // Croix centrale
    svg += `<line x1="${CX}" y1="${CY - 8}" x2="${CX}" y2="${CY + 8}" stroke="#4338ca" stroke-width="0.8"/>`;
    svg += `<line x1="${CX - 8}" y1="${CY}" x2="${CX + 8}" y2="${CY}" stroke="#4338ca" stroke-width="0.8"/>`;

    svg += `</svg>`;
    return svg;
}
