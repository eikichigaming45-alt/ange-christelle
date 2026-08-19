// ============================================================
// routes/astrologie.js
// Horoscope du jour par signe — scraping horoscope.fr.
// Route publique (pas d'auth) — le signe est passé en query string.
// Cache journalier en mémoire par signe pour limiter les requêtes.
// Même pattern que routes/priere.js.
// ============================================================

const express = require('express');
const router  = express.Router();
const https   = require('https');
const cheerio = require('cheerio');

// ── Mapping signe → slug horoscope.fr ────────────────────────
const SLUGS = {
    belier      : 'belier',
    taureau     : 'taureau',
    gemeaux     : 'gemeaux',
    cancer      : 'cancer',
    lion        : 'lion',
    vierge      : 'vierge',
    balance     : 'balance',
    scorpion    : 'scorpion',
    sagittaire  : 'sagittaire',
    capricorne  : 'capricorne',
    verseau     : 'verseau',
    poissons    : 'poissons'
};

// ── Mapping signe → emoji ─────────────────────────────────────
const EMOJIS = {
    belier      : '♈',
    taureau     : '♉',
    gemeaux     : '♊',
    cancer      : '♋',
    lion        : '♌',
    vierge      : '♍',
    balance     : '♎',
    scorpion    : '♏',
    sagittaire  : '♐',
    capricorne  : '♑',
    verseau     : '♒',
    poissons    : '♓'
};

// ── Mapping signe → label français ───────────────────────────
const LABELS = {
    belier      : 'Bélier',
    taureau     : 'Taureau',
    gemeaux     : 'Gémeaux',
    cancer      : 'Cancer',
    lion        : 'Lion',
    vierge      : 'Vierge',
    balance     : 'Balance',
    scorpion    : 'Scorpion',
    sagittaire  : 'Sagittaire',
    capricorne  : 'Capricorne',
    verseau     : 'Verseau',
    poissons    : 'Poissons'
};

// ── Calcul du signe depuis une date de naissance ──────────────
function calculerSigne(dateNaissance) {
    const d = new Date(dateNaissance);
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

// ── Cache journalier par signe ────────────────────────────────
// Structure : { [signe]: { data, date } }
const cache = {};

// ── Scraping horoscope.fr ─────────────────────────────────────
function scrapeHoroscope(signe) {
    const today = new Date().toISOString().split('T')[0];
    if (cache[signe] && cache[signe].date === today) {
        return Promise.resolve(cache[signe].data);
    }

    const slug = SLUGS[signe];
    const url  = `https://www.horoscope.fr/horoscopes/aujourdhui/${slug}`;

    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const $        = cheerio.load(data);
                    const sections = [];

                    // ── Extraction des sections thématiques ───
                    // horoscope.fr structure ses textes en blocs h2/h3 + paragraphes
                    $('h2, h3').each((i, el) => {
                        const titre = $(el).text().trim();
                        let texte   = '';
                        let next    = $(el).next();
                        while (next.length && !next.is('h2, h3')) {
                            if (next.is('p')) texte += next.text().trim() + ' ';
                            next = next.next();
                        }
                        if (texte.trim().length > 20) {
                            sections.push({ titre: titre, texte: texte.trim() });
                        }
                    });

                    // ── Fallback : paragraphes principaux ─────
                    if (sections.length === 0) {
                        $('p').each((i, el) => {
                            const t = $(el).text().trim();
                            if (t.length > 40) sections.push({ titre: '', texte: t });
                        });
                    }

                    const result = {
                        signe   : signe,
                        label   : LABELS[signe],
                        emoji   : EMOJIS[signe],
                        sections: sections,
                        resume  : sections[0]?.texte?.substring(0, 150) || '',
                        date    : today
                    };

                    cache[signe] = { data: result, date: today };
                    resolve(result);
                } catch (e) {
                    console.error('[ASTRO] Erreur parsing :', e.message);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error('[ASTRO] Erreur réseau :', e.message);
            resolve(null);
        });
    });
}

// ── GET /api/astrologie?signe=belier ─────────────────────────
// Retourne l'horoscope du jour pour le signe demandé.
// Si signe absent ou invalide → 400.
router.get('/', async (req, res) => {
    const signe = req.query.signe?.toLowerCase();

    if (!signe || !SLUGS[signe]) {
        return res.status(400).json({
            success: false,
            message: 'Signe invalide. Valeurs acceptées : ' + Object.keys(SLUGS).join(', ')
        });
    }

    try {
        const data = await scrapeHoroscope(signe);
        if (!data) {
            return res.json({
                success : false,
                signe   : signe,
                label   : LABELS[signe],
                emoji   : EMOJIS[signe],
                resume  : 'Horoscope temporairement indisponible.',
                sections: []
            });
        }
        res.json({ success: true, ...data });
    } catch (e) {
        console.error('[ASTRO] Erreur :', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── GET /api/astrologie/signes ────────────────────────────────
// Retourne la liste complète des signes avec emoji et label.
// Utilisé par le front pour le selector de signe.
router.get('/signes', (req, res) => {
    const signes = Object.keys(SLUGS).map(s => ({
        signe : s,
        label : LABELS[s],
        emoji : EMOJIS[s]
    }));
    res.json({ success: true, signes });
});

// ── GET /api/astrologie/signe-par-date?date=YYYY-MM-DD ───────
// Calcule et retourne le signe zodiacal depuis une date de naissance.
// Utilisé par le front au chargement si date_naissance disponible.
router.get('/signe-par-date', (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, message: 'Date requise.' });
    }
    try {
        const signe = calculerSigne(date);
        res.json({
            success : true,
            signe   : signe,
            label   : LABELS[signe],
            emoji   : EMOJIS[signe]
        });
    } catch (e) {
        res.status(400).json({ success: false, message: 'Date invalide.' });
    }
});

module.exports = router;
