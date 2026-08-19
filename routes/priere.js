// ============================================================
// routes/priere.js
// Textes du jour scrapés depuis eglise.catholique.fr.
// Route publique — pas d'authentification requise.
// Cache journalier en mémoire pour limiter les requêtes externes.
// ============================================================

const express  = require('express');
const router   = express.Router();
const https    = require('https');
const cheerio  = require('cheerio');

// ── Cache journalier ──────────────────────────────────────────
// Réinitialisé à chaque redémarrage du serveur (normal sur Render).
let cache     = null;
let cacheDate = null;

// ── Texte de secours si le scraping échoue ────────────────────
const TEXTE_SECOURS = {
    texte  : 'Je puis tout par celui qui me fortifie.',
    ref    : 'Philippiens 4:13',
    source : 'local'
};

// ── Scraping des textes du jour ───────────────────────────────
async function fetchTextesDuJour() {
    const today = new Date().toISOString().split('T')[0];
    if (cache && cacheDate === today) return cache;

    return new Promise((resolve) => {
        https.get('https://eglise.catholique.fr/textes-du-jour/', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const $        = cheerio.load(data);
                    const sections = [];

                    $('h3').each((i, el) => {
                        const titre = $(el).text().trim();
                        let texte   = '';
                        let next    = $(el).next();
                        while (next.length && next[0].tagName !== 'h3') {
                            texte += next.text().trim() + '\n';
                            next   = next.next();
                        }
                        sections.push({ titre, texte: texte.trim() });
                    });

                    const evangile = sections.find(s =>
                        s.titre.toLowerCase().includes('évangile') ||
                        s.titre.toLowerCase().includes('evangile')
                    );
                    const lecture1 = sections.find(s =>
                        s.titre.toLowerCase().includes('première lecture') ||
                        s.titre.toLowerCase().includes('premiere lecture')
                    );

                    cache     = { evangile: evangile || null, lecture1: lecture1 || null, date: today };
                    cacheDate = today;
                    resolve(cache);
                } catch (e) {
                    console.error('[PRIERE] Erreur parsing :', e.message);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error('[PRIERE] Erreur réseau :', e.message);
            resolve(null);
        });
    });
}

// ── GET /api/priere ───────────────────────────────────────────
// Retourne l'évangile et la première lecture du jour.
// Retourne un texte de secours si le scraping échoue.
router.get('/', async (req, res) => {
    try {
        const data = await fetchTextesDuJour();

        if (!data || !data.evangile) {
            return res.json(TEXTE_SECOURS);
        }

        // Extraction du titre court entre guillemets
        const titreMatch = data.evangile.titre.match(/«\s*(.+?)\s*»/);

        // Extrait les 3 premières lignes significatives de l'évangile
        const premieresLignes = data.evangile.texte
            .split('\n')
            .filter(l => l.trim().length > 20)
            .slice(0, 3)
            .join(' ');

        res.json({
            texte        : premieresLignes,
            ref          : data.evangile.titre,
            titre        : titreMatch ? titreMatch[1] : data.evangile.titre,
            evangile     : data.evangile.texte,
            lecture1     : data.lecture1 ? data.lecture1.texte : null,
            lecture1titre: data.lecture1 ? data.lecture1.titre : null,
            source       : 'catholique.fr'
        });
    } catch (e) {
        console.error('[PRIERE] Erreur :', e.message);
        res.json(TEXTE_SECOURS);
    }
});

module.exports = router;
