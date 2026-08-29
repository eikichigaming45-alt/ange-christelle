// ============================================================
// routes/theme-astral.js
// Thème astral natal — FreeAstroAPI v2 + Groq + cache BDD
// ============================================================

const express               = require('express');
const router                = express.Router();
const { pool }              = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const FREEASTRO_URL = 'https://api.freeastroapi.com/api/v1/natal/calculate';
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

// ── Normaliser une planète depuis le format API ───────────────
function normaliserPlanete(p) {
    const name       = p.planet?.en || p.name || '';
    const sign       = p.zodiac_sign?.name?.en || p.sign || '';
    const fullDegree = p.longitude    != null ? parseFloat(p.longitude)    :
                       p.fullDegree   != null ? parseFloat(p.fullDegree)   : null;
    const normDegree = fullDegree     != null ? (fullDegree % 30).toFixed(1) :
                       p.normDegree   != null ? parseFloat(p.normDegree).toFixed(1) : null;
    return {
        name,
        sign,
        fullDegree,
        normDegree,
        isRetro : p.is_retrograde ?? p.isRetro ?? false,
        house   : p.house || null,
        nameFR  : PLANETES_FR[name]  || name,
        signeFR : SIGNES_FR[sign]    || sign,
        emoji   : SIGNES_EMOJI[sign] || ''
    };
}

// ── Calcul dominante planétaire ───────────────────────────────
function calculerDominante(planetes) {
    const scores = {};
    planetes.forEach(p => {
        if (!PLANETES_FR[p.name]) return;
        scores[p.name] = (scores[p.name] || 0) + 1;
        if (p.house) scores[p.name] += 0.5;
    });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
}

// ── GET /api/theme-astral ─────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const { rows } = await pool.query(
            'SELECT date_naissance, heure_naissance, naissance_lat, naissance_lon, lieu_naissance, astral_cache FROM profiles WHERE user_id = \$1',
            [userId]
        );

        if (!rows.length) {
            return res.json({ success: false, code: 'NO_PROFILE' });
        }

        const profil = rows[0];

        if (!profil.date_naissance) {
            return res.json({ success: false, code: 'NO_DATE' });
        }
        if (!profil.lieu_naissance && (!profil.naissance_lat || !profil.naissance_lon)) {
            return res.json({ success: false, code: 'NO_LOCATION' });
        }

        const hasHeure = !!profil.heure_naissance;

        if (profil.astral_cache) {
            return res.json({ success: true, data: profil.astral_cache, fromCache: true });
        }

        const dateNaissance = new Date(profil.date_naissance);
        const heureStr      = hasHeure ? profil.heure_naissance.slice(0, 5) : '12:00';
        const [hh, mm]      = heureStr.split(':').map(Number);

        const payload = {
            year  : dateNaissance.getFullYear(),
            month : dateNaissance.getMonth() + 1,
            day   : dateNaissance.getDate(),
            hour  : hh,
            minute: mm,
            city  : profil.lieu_naissance || 'Paris'
        };

        if (profil.naissance_lat && profil.naissance_lon) {
            payload.lat = parseFloat(profil.naissance_lat);
            payload.lng = parseFloat(profil.naissance_lon);
        }

        console.log('[THEME-ASTRAL] Payload envoyé:', JSON.stringify(payload));

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
        console.log('[THEME-ASTRAL] Réponse API (keys):', Object.keys(astroData));

        let rawPlanetes = [];
        if (Array.isArray(astroData.planets)) {
            rawPlanetes = astroData.planets;
        } else if (astroData.planets && typeof astroData.planets === 'object') {
            rawPlanetes = Object.values(astroData.planets);
        } else if (Array.isArray(astroData.output)) {
            rawPlanetes = astroData.output;
        }

        if (astroData.angles) {
            const anglesArr = Array.isArray(astroData.angles)
                ? astroData.angles
                : Object.values(astroData.angles);
            rawPlanetes = [...rawPlanetes, ...anglesArr];
        }

        if (rawPlanetes.length > 0) {
            console.log('[THEME-ASTRAL] Format planète exemple:', JSON.stringify(rawPlanetes[0]));
        } else {
            console.error('[THEME-ASTRAL] Aucune planète extraite. Réponse complète:', JSON.stringify(astroData));
        }

        const planetesFR = rawPlanetes.map(normaliserPlanete);

        const soleil    = planetesFR.find(p => p.name === 'Sun');
        const lune      = planetesFR.find(p => p.name === 'Moon');
        const ascendant = planetesFR.find(p =>
            p.name === 'Ascendant' || p.name === 'ASC' || p.name === 'Asc'
        );
        const mc        = planetesFR.find(p =>
            p.name === 'MC' || p.name === 'Midheaven'
        );
        const dominante   = calculerDominante(planetesFR);
        const dominanteFR = dominante ? (PLANETES_FR[dominante] || dominante) : null;

        let interpretation = null;
        try {
            const promptParts = [
                `Tu es un astrologue expert. Génère une interprétation narrative du thème natal en français, structurée en 4 parties courtes (3-4 phrases chacune) :`,
                `1. **Soleil en ${soleil?.signeFR || '?'}** — identité profonde, ego, vitalité`,
                ascendant
                    ? `2. **Ascendant ${ascendant.signeFR}** — façade, première impression, corps`
                    : `2. **Ascendant** — non calculé (heure de naissance manquante)`,
                mc ? `3. **Milieu du Ciel en ${mc.signeFR}** — vocation, ambitions, image publique` : '',
                `4. **Dominante planétaire : ${dominanteFR || '?'}** — énergie principale du thème`,
                `Lune en ${lune?.signeFR || '?'}${lune?.house ? ', en maison ' + lune.house : ''}.`,
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
                    max_tokens : 1200,
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

        const cacheData = {
            planetes    : planetesFR,
            soleil,
            lune,
            ascendant   : hasHeure ? ascendant : null,
            mc          : hasHeure ? mc : null,
            dominante,
            dominanteFR,
            interpretation,
            hasHeure,
            generatedAt : new Date().toISOString().split('T')[0]
        };

        await pool.query(
            'UPDATE profiles SET astral_cache = \$1 WHERE user_id = \$2',
            [JSON.stringify(cacheData), userId]
        );

        return res.json({ success: true, data: cacheData, fromCache: false });

    } catch (err) {
        console.error('[THEME-ASTRAL] Erreur:', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── DELETE /api/theme-astral/cache — reset tous users (admin uniquement) ──
router.delete('/cache', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    try {
        await pool.query('UPDATE profiles SET astral_cache = NULL');
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
