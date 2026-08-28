// ============================================================
// routes/theme-astral.js
// Thème astral natal — FreeAstroAPI + Groq + cache BDD
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const FREEASTRO_URL = 'https://json.freeastrologyapi.com/western/planets';
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'openai/gpt-oss-20b';

// ── Mappings FR ───────────────────────────────────────────────
const PLANETES_FR = {
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

const SIGNES_FR = {
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

const SIGNES_EMOJI = {
    Aries:'♈', Taurus:'♉', Gemini:'♊', Cancer:'♋',
    Leo:'♌', Virgo:'♍', Libra:'♎', Scorpio:'♏',
    Sagittarius:'♐', Capricorn:'♑', Aquarius:'♒', Pisces:'♓'
};

// ── Calcul dominante planétaire ───────────────────────────────
function calculerDominante(planetes) {
    const scores = {};
    planetes.forEach(p => {
        const nom = p.name;
        if (!PLANETES_FR[nom]) return;
        scores[nom] = (scores[nom] || 0) + 1;
        if (p.house) scores[nom] += 0.5;
    });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
}

// ── Calcul offset UTC depuis coordonnées et date ──────────────
function calculerTimezoneOffset(lat, lon, dateNaissance, hh, mm) {
    try {
        const { find } = require('geo-tz');
        const tzResult = find(parseFloat(lat), parseFloat(lon));
        if (!tzResult || !tzResult.length) return 0;
        const tzName    = tzResult[0];
        const dateRef   = new Date(
            dateNaissance.getFullYear(),
            dateNaissance.getMonth(),
            dateNaissance.getDate(),
            hh, mm, 0
        );
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone    : tzName,
            timeZoneName: 'shortOffset'
        });
        const parts  = formatter.formatToParts(dateRef);
        const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
        const match  = tzPart.match(/GMT([+-]\d+(?::\d+)?)?/);
        if (match && match[1]) {
            const raw     = match[1];
            const sign    = raw[0] === '-' ? -1 : 1;
            const [h, m]  = raw.replace(/[+-]/, '').split(':').map(Number);
            return sign * (h + (m ? m / 60 : 0));
        }
        return 0;
    } catch {
        return 0;
    }
}

// ── GET /api/theme-astral ─────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        // 1. Récupérer le profil
        const { rows } = await pool.query(
            'SELECT date_naissance, heure_naissance, naissance_lat, naissance_lon, astral_cache, astral_cache_date FROM profiles WHERE user_id = \$1',
            [userId]
        );

        if (!rows.length) {
            return res.json({ success: false, code: 'NO_PROFILE' });
        }

        const profil = rows[0];

        // 2. Vérifier données minimales
        if (!profil.date_naissance) {
            return res.json({ success: false, code: 'NO_DATE' });
        }
        if (!profil.naissance_lat || !profil.naissance_lon) {
            return res.json({ success: false, code: 'NO_LOCATION' });
        }

        const hasHeure = !!profil.heure_naissance;

        // 3. Vérifier cache journalier
        const today = new Date().toISOString().split('T')[0];
        if (
            profil.astral_cache &&
            profil.astral_cache_date &&
            profil.astral_cache_date.toISOString().split('T')[0] === today
        ) {
            return res.json({ success: true, data: profil.astral_cache, fromCache: true });
        }

        // 4. Préparer payload FreeAstroAPI
        const dateNaissance = new Date(profil.date_naissance);
        const heureStr      = hasHeure ? profil.heure_naissance.slice(0, 5) : '12:00';
        const [hh, mm]      = heureStr.split(':').map(Number);

        const timezoneOffset = calculerTimezoneOffset(
            profil.naissance_lat,
            profil.naissance_lon,
            dateNaissance,
            hh, mm
        );

        const payload = {
            year     : dateNaissance.getFullYear(),
            month    : dateNaissance.getMonth() + 1,
            date     : dateNaissance.getDate(),
            hours    : hh,
            minutes  : mm,
            seconds  : 0,
            latitude : parseFloat(profil.naissance_lat),
            longitude: parseFloat(profil.naissance_lon),
            timezone : timezoneOffset,
            config   : {
                observation_point: 'topocentric'
            }
        };

        // 5. Appel FreeAstroAPI
        const astroRes = await fetch(FREEASTRO_URL, {
            method : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key'   : process.env.FREEASTROAPI_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!astroRes.ok) {
            const errTxt = await astroRes.text();
            console.error('[THEME-ASTRAL] FreeAstroAPI error:', astroRes.status, errTxt);
            return res.json({ success: false, code: 'API_ERROR', message: 'FreeAstroAPI indisponible.' });
        }

        const astroData = await astroRes.json();
        const planetes  = astroData.output || [];

        // 6. Enrichir avec labels FR
        const planetesFR = planetes.map(p => ({
            ...p,
            nameFR : PLANETES_FR[p.name] || p.name,
            signeFR: SIGNES_FR[p.sign]   || p.sign,
            emoji  : SIGNES_EMOJI[p.sign] || ''
        }));

        // 7. Extraire points clés
        const soleil      = planetesFR.find(p => p.name === 'Sun');
        const lune        = planetesFR.find(p => p.name === 'Moon');
        const ascendant   = planetesFR.find(p => p.name === 'Ascendant');
        const mc          = planetesFR.find(p => p.name === 'MC');
        const dominante   = calculerDominante(planetesFR);
        const dominanteFR = dominante ? (PLANETES_FR[dominante] || dominante) : null;

        // 8. Appel Groq — interprétation narrative
        let interpretation = null;
        try {
            const promptParts = [
                `Tu es un astrologue expert. Génère une interprétation narrative du thème natal en français, structurée en 4 parties courtes (3-4 phrases chacune) :`,
                `1. **Soleil en ${soleil?.signeFR || '?'}** — identité profonde, ego, vitalité`,
                ascendant ? `2. **Ascendant ${ascendant.signeFR}** — façade, première impression, corps` : `2. **Ascendant** — non calculé (heure de naissance manquante)`,
                mc ? `3. **Milieu du Ciel en ${mc.signeFR}** — vocation, ambitions, image publique` : '',
                `4. **Dominante planétaire : ${dominanteFR || '?'}** — énergie principale du thème`,
                `Lune en ${lune?.signeFR || '?'}, en maison ${lune?.house || '?'}.`,
                `Sois précis, bienveillant, et évite les généralités vagues. Pas de bullet points — texte fluide uniquement.`,
                !hasHeure ? `Note : l'heure de naissance est inconnue, l'Ascendant et le MC sont donc absents.` : ''
            ].filter(Boolean).join('\n');

            const groqRes = await fetch(GROQ_URL, {
                method : 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model      : GROQ_MODEL,
                    messages   : [{ role: 'user', content: promptParts }],
                    max_tokens : 700,
                    temperature: 0.7
                })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                interpretation = groqData.choices?.[0]?.message?.content?.trim() || null;
            }
        } catch (groqErr) {
            console.error('[THEME-ASTRAL] Groq error:', groqErr.message);
        }

        // 9. Construire objet cache
        const cacheData = {
            planetes     : planetesFR,
            soleil,
            lune,
            ascendant    : hasHeure ? ascendant : null,
            mc           : hasHeure ? mc : null,
            dominante,
            dominanteFR,
            interpretation,
            hasHeure,
            generatedAt  : today
        };

        // 10. Sauvegarder en BDD
        await pool.query(
            'UPDATE profiles SET astral_cache = \$1, astral_cache_date = \$2 WHERE user_id = \$3',
            [JSON.stringify(cacheData), today, userId]
        );

        return res.json({ success: true, data: cacheData, fromCache: false });

    } catch (err) {
        console.error('[THEME-ASTRAL] Erreur:', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/theme-astral/cache — forcer recalcul (admin) ──
router.delete('/cache', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    try {
        await pool.query(
            'UPDATE profiles SET astral_cache = NULL, astral_cache_date = NULL WHERE user_id = \$1',
            [req.user.id]
        );
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
