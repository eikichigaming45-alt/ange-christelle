// ============================================================
// routes/islam.js
// Horaires de prières (API Aladhan) + Hadith et Doua du jour
// (API HadeethEnc). Route publique — pas d'authentification.
// Cache journalier en mémoire pour le hadith/doua.
// ============================================================

const express = require('express');
const router  = express.Router();
const https   = require('https');

// ── Cache journalier hadith + doua ────────────────────────────
let hadithCache     = null;
let hadithCacheDate = null;
let idsDispoFr      = [];

// ── Utilitaire requête HTTPS JSON ─────────────────────────────
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// ── Chargement des IDs de hadiths disponibles en français ─────
async function chargerIdsFr() {
    if (idsDispoFr.length > 0) return;
    try {
        const data = await httpsGet(
            'https://hadeethenc.com/api/v1/hadeeths/list/?language=fr&category_id=1&page=1&per_page=200'
        );
        if (data?.data?.length) {
            idsDispoFr = data.data.map(h => parseInt(h.id)).filter(Boolean);
        }
    } catch (e) {
        console.error('[ISLAM] Erreur chargement IDs :', e.message);
    }
    if (idsDispoFr.length === 0) idsDispoFr = [1, 2, 3, 4, 5];
}

// ── Récupération d'un hadith en français et en arabe ──────────
async function fetchHadith(id) {
    try {
        const [fr, ar] = await Promise.all([
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=fr&id=${id}`),
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${id}`)
        ]);
        if (fr?.hadeeth && fr.hadeeth.length > 10) {
            return { ar: ar?.hadeeth || '', fr: fr.hadeeth, ref: fr.attribution || '' };
        }
    } catch (e) {
        console.error('[ISLAM] Erreur fetch hadith :', e.message);
    }
    return null;
}

// ── Sélection de la méthode de calcul selon la zone géo ───────
// Adapte les horaires de prière selon la localisation.
function getMethode(lat, lon) {
    if (lon >= -10 && lon <= 25 && lat >= 35 && lat <= 72) return 12; // Europe
    if (lon >= -20 && lon <= 55 && lat >= -5 && lat <= 40) return 5;  // Afrique/Moyen-Orient
    if (lon >= 25  && lon <= 60 && lat >= 12 && lat <= 32) return 4;  // Péninsule arabique
    if (lon >= 44  && lon <= 142 && lat >= -10 && lat <= 55) return 1; // Asie
    return 2; // Reste du monde (ISNA)
}

// ── GET /api/islam ────────────────────────────────────────────
// Retourne les horaires de prières + hadith + doua du jour.
// Paramètres requis : lat, lon (coordonnées GPS).
router.get('/', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ success: false, message: 'lat et lon requis.' });
    }

    try {
        const today    = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const jour     = String(today.getDate()).padStart(2, '0');
        const mois     = String(today.getMonth() + 1).padStart(2, '0');
        const annee    = today.getFullYear();
        const dateStr  = `${jour}-${mois}-${annee}`;
        const jourAn   = Math.floor((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + 1;
        const methode  = getMethode(lat, lon);

        // Hadith + doua : cache journalier indépendant de la ville
        if (!hadithCache || hadithCacheDate !== todayStr) {
            await chargerIdsFr();
            const mi  = idsDispoFr.length;
            const idH = idsDispoFr[jourAn % mi];
            const idD = idsDispoFr[(jourAn + Math.floor(mi / 2)) % mi];
            const [h, d] = await Promise.all([fetchHadith(idH), fetchHadith(idD)]);
            hadithCache     = { hadith: h, doua: d };
            hadithCacheDate = todayStr;
        }

        // Horaires : calculés selon lat/lon + méthode
        const dataAladhan = await httpsGet(
            `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=${methode}`
        );

        if (!dataAladhan || dataAladhan.code !== 200) {
            return res.json({
                success: false,
                fajr: '--:--', dhuhr: '--:--', asr: '--:--',
                maghrib: '--:--', isha: '--:--',
                hadithAr: '', hadithFr: '', hadithRef: '',
                douaAr: '', douaFr: '', douaRef: '',
                erreur: true
            });
        }

        const t         = dataAladhan.data.timings;
        const dateLabel = today.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        res.json({
            success  : true,
            date     : dateLabel,
            fajr     : t.Fajr,
            dhuhr    : t.Dhuhr,
            asr      : t.Asr,
            maghrib  : t.Maghrib,
            isha     : t.Isha,
            hadithAr : hadithCache.hadith?.ar  || '',
            hadithFr : hadithCache.hadith?.fr  || '',
            hadithRef: hadithCache.hadith?.ref || '',
            douaAr   : hadithCache.doua?.ar   || '',
            douaFr   : hadithCache.doua?.fr   || '',
            douaRef  : hadithCache.doua?.ref  || ''
        });

    } catch (e) {
        console.error('[ISLAM] Erreur :', e.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
