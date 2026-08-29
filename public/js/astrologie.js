// ============================================================
// public/js/astrologie.js
// Widget Astrologie — horoscope du jour par signe zodiacal.
// Signe calculé depuis date_naissance du profil ou saisi manuellement.
// Auth via JWT Bearer uniquement. Route /api/astrologie publique.
// ============================================================

// ── Mapping complet des signes ────────────────────────────────
const SIGNES_ZODIAQUE = [
    { signe: 'belier',     label: 'Bélier',      emoji: '♈', dates: '21 mars – 19 avril' },
    { signe: 'taureau',    label: 'Taureau',     emoji: '♉', dates: '20 avril – 20 mai' },
    { signe: 'gemeaux',    label: 'Gémeaux',     emoji: '♊', dates: '21 mai – 20 juin' },
    { signe: 'cancer',     label: 'Cancer',      emoji: '♋', dates: '21 juin – 22 juillet' },
    { signe: 'lion',       label: 'Lion',        emoji: '♌', dates: '23 juillet – 22 août' },
    { signe: 'vierge',     label: 'Vierge',      emoji: '♍', dates: '23 août – 22 septembre' },
    { signe: 'balance',    label: 'Balance',     emoji: '♎', dates: '23 septembre – 22 octobre' },
    { signe: 'scorpion',   label: 'Scorpion',    emoji: '♏', dates: '23 octobre – 21 novembre' },
    { signe: 'sagittaire', label: 'Sagittaire',  emoji: '♐', dates: '22 novembre – 21 décembre' },
    { signe: 'capricorne', label: 'Capricorne',  emoji: '♑', dates: '22 décembre – 19 janvier' },
    { signe: 'verseau',    label: 'Verseau',     emoji: '♒', dates: '20 janvier – 18 février' },
    { signe: 'poissons',   label: 'Poissons',    emoji: '♓', dates: '19 février – 20 mars' },
];

// ── Calcul du signe depuis date_naissance (côté front) ───────
function _calculerSigneLocal(dateStr) {
    const d = new Date(dateStr);
    const j = d.getDate();
    const m = d.getMonth() + 1;
    if ((m === 3  && j >= 21) || (m === 4  && j <= 19)) return 'belier';
    if ((m === 4  && j >= 20) || (m === 5  && j <= 20)) return 'taureau';
    if ((m === 5  && j >= 21) || (m === 6  && j <= 20)) return 'gemeaux';
    if ((m === 6  && j >= 21) || (m === 7  && j <= 22)) return 'cancer';
    if ((m === 7  && j >= 23) || (m === 8  && j <= 22)) return 'lion';
    if ((m === 8  && j >= 23) || (m === 9  && j <= 22)) return 'vierge';
    if ((m === 9  && j >= 23) || (m === 10 && j <= 22)) return 'balance';
    if ((m === 10 && j >= 23) || (m === 11 && j <= 21)) return 'scorpion';
    if ((m === 11 && j >= 22) || (m === 12 && j <= 21)) return 'sagittaire';
    if ((m === 12 && j >= 22) || (m === 1  && j <= 19)) return 'capricorne';
    if ((m === 1  && j >= 20) || (m === 2  && j <= 18)) return 'verseau';
    return 'poissons';
}

function _getSigneInfo(signe) {
    return SIGNES_ZODIAQUE.find(s => s.signe === signe) || null;
}

// ── Chargement du widget ──────────────────────────────────────
async function chargerAstrologie() {
    const el   = document.getElementById('wc-astrologie');
    const user = getUser();
    if (!el || !user?.token) return;

    el.innerHTML = '<p style="color:#9ca3af;font-size:13px">Chargement...</p>';

    try {
        // ── 1. Récupération du profil pour date_naissance / signe_zodiaque
        const rProfil = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const dProfil = await rProfil.json();
        const profil  = dProfil.profil || {};

        // ── 2. Détermination du signe
        // Priorité : date_naissance > signe_zodiaque manuel
        let signe = null;
        if (profil.date_naissance) {
            signe = _calculerSigneLocal(profil.date_naissance);
        } else if (profil.signe_zodiaque) {
            signe = profil.signe_zodiaque;
        }

        // ── 3. Pas de signe → invite à compléter le profil
        if (!signe) {
            el.innerHTML = `
                <div class="astro-no-signe">
                    <div style="font-size:32px;margin-bottom:8px">✨</div>
                    <div style="font-size:13px;color:#555;margin-bottom:12px">
                        Renseignez votre date de naissance ou choisissez votre signe dans votre profil.
                    </div>
                    <button class="astro-btn-profil" onclick="ouvrirMonProfil()">
                        Compléter le profil
                    </button>
                </div>`;
            return;
        }

        // ── 4. Chargement de l'horoscope
        const info = _getSigneInfo(signe);
        const r    = await fetch(`/api/astrologie?signe=${signe}`);
        const d    = await r.json();

        el.innerHTML = `
            <div class="astro-widget">
                <div class="astro-signe-row">
                    <span class="astro-emoji">${info?.emoji || '✨'}</span>
                    <div>
                        <div class="astro-signe-label">${info?.label || signe}</div>
                        <div class="astro-signe-dates">${info?.dates || ''}</div>
                    </div>
                </div>
                <div class="astro-resume">
                    ${d.resume || 'Horoscope indisponible pour le moment.'}
                </div>
            </div>`;
    } catch {
        el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erreur de chargement.</p>';
    }
}

// ── Modale complète ───────────────────────────────────────────
async function ouvrirModaleAstrologie() {
    const user = getUser();
    if (!user?.token) return;

    document.getElementById('modal-title').textContent = 'Astrologie';
    document.getElementById('modal-body').innerHTML =
        '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';
    document.getElementById('overlay').classList.add('on');

    try {
        // ── Profil pour signe par défaut
        const rProfil = await fetch('/api/profil', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        const dProfil = await rProfil.json();
        const profil  = dProfil.profil || {};

        let signeActif = null;
        if (profil.date_naissance) {
            signeActif = _calculerSigneLocal(profil.date_naissance);
        } else if (profil.signe_zodiaque) {
            signeActif = profil.signe_zodiaque;
        }

        await _renderModaleAstrologie(signeActif || 'belier');
    } catch {
        document.getElementById('modal-body').innerHTML =
            '<p style="color:#ef4444;text-align:center">Erreur de chargement.</p>';
    }
}

async function _renderModaleAstrologie(signe) {
    const body = document.getElementById('modal-body');
    if (!body) return;

    body.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Chargement...</p>';

    try {
        const r    = await fetch(`/api/astrologie?signe=${signe}`);
        const d    = await r.json();
        const info = _getSigneInfo(signe);

        // ── Selector de signe ─────────────────────────────────
        const selectorHTML = `
            <div class="astro-selector">
                ${SIGNES_ZODIAQUE.map(s => `
                    <button class="astro-selector-btn ${s.signe === signe ? 'active' : ''}"
                        onclick="_renderModaleAstrologie('${s.signe}')">
                        ${s.emoji} ${s.label}
                    </button>
                `).join('')}
            </div>
        `;

        // ── Sections horoscope ────────────────────────────────
        const sectionsHTML = (d.sections || []).length > 0
            ? d.sections.map(s => `
                <div class="astro-section">
                    ${s.titre ? `<div class="astro-section-titre">${s.titre}</div>` : ''}
                    <div class="astro-section-texte">${s.texte}</div>
                </div>
            `).join('')
            : `<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">
                Horoscope temporairement indisponible.
               </p>`;

        body.innerHTML = `
            <div class="astro-modal">
                ${selectorHTML}
                <div class="astro-modal-header">
                    <span class="astro-modal-emoji">${info?.emoji || '✨'}</span>
                    <div>
                        <div class="astro-modal-signe">${info?.label || signe}</div>
                        <div class="astro-modal-dates">${info?.dates || ''}</div>
                    </div>
                </div>
                <div class="astro-sections">${sectionsHTML}</div>
            </div>
        `;
    } catch {
        body.innerHTML =
            '<p style="color:#ef4444;text-align:center">Erreur de chargement.</p>';
    }
}

// ── Exposition globale ────────────────────────────────────────
window.chargerAstrologie      = chargerAstrologie;
window.ouvrirModaleAstrologie = ouvrirModaleAstrologie;
window._renderModaleAstrologie = _renderModaleAstrologie;
