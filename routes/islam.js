const express = require('express');
const router  = express.Router();
const https   = require('https');

let cache = null;
let cacheDate = null;

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function fetchHadith(idHadith) {
    try {
        const [fr, ar] = await Promise.all([
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=fr&id=${idHadith}`),
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${idHadith}`)
        ]);
        if (!fr?.hadeeth || !ar?.hadeeth) return null;
        return {
            ar : ar.hadeeth,
            fr : fr.hadeeth,
            ref: fr.attribution || ar.attribution || ''
        };
    } catch(e) {
        return null;
    }
}

router.get('/', async (req, res) => {
    try {
        const today    = new Date();
        const todayStr = today.toISOString().split('T')[0];
        if (cache && cacheDate === todayStr) return res.json(cache);

        const jour  = String(today.getDate()).padStart(2,'0');
        const mois  = String(today.getMonth()+1).padStart(2,'0');
        const annee = today.getFullYear();
        const dateStr = `${jour}-${mois}-${annee}`;

        // Horaires Aladhan — coordonnées Chécy, méthode 12 UOIF France
        const urlAladhan = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=47.9167&longitude=1.9167&method=12`;
        const dataAladhan = await httpsGet(urlAladhan);

        if (!dataAladhan || dataAladhan.code !== 200) {
            return res.json({
                date:'', fajr:'--:--', dhuhr:'--:--',
                asr:'--:--', maghrib:'--:--', isha:'--:--',
                hadithAr:'دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ',
                hadithFr:'Évite ce qui te fait douter au profit de ce qui ne te fait pas douter.',
                hadithRef:'Tirmidhi', erreur: true
            });
        }

        const t = dataAladhan.data.timings;
        const dateLabel = today.toLocaleDateString('fr-FR', {
            weekday:'long', day:'numeric', month:'long', year:'numeric'
        });

        // ID hadith basé sur le jour de l'année (1-365)
        const debut = new Date(today.getFullYear(), 0, 0);
        const diff  = today - debut;
        const jourAnnee = Math.floor(diff / (1000 * 60 * 60 * 24));
        const idHadith  = (jourAnnee % 100) + 1; // IDs 1 à 100 sont fiables

        const hadith = await fetchHadith(idHadith);

        cache = {
            date     : dateLabel,
            fajr     : t.Fajr,
            dhuhr    : t.Dhuhr,
            asr      : t.Asr,
            maghrib  : t.Maghrib,
            isha     : t.Isha,
            hadithAr : hadith?.ar  || 'دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ',
            hadithFr : hadith?.fr  || 'Évite ce qui te fait douter au profit de ce qui ne te fait pas douter.',
            hadithRef: hadith?.ref || 'Tirmidhi'
        };
        cacheDate = todayStr;
        res.json(cache);

    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
