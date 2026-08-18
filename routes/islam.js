const express = require('express');
const router  = express.Router();
const https   = require('https');

let cache = {};

// IDs HadeethEnc confirmés avec traduction française disponible
const IDS_HADITHS_FR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const IDS_DOUAS_FR   = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];

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

async function fetchHadithDepuisListe(ids, jourAn) {
    const id = ids[jourAn % ids.length];
    try {
        const [fr, ar] = await Promise.all([
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=fr&id=${id}`),
            httpsGet(`https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${id}`)
        ]);
        if (fr?.hadeeth && fr.hadeeth.length > 10) {
            return { ar: ar?.hadeeth || '', fr: fr.hadeeth, ref: fr.attribution || '' };
        }
    } catch(e) {}
    return null;
}

router.get('/', async (req, res) => {
    try {
        const today    = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const lat = parseFloat(req.query.lat) || 48.8566;
        const lon = parseFloat(req.query.lon) || 2.3522;
        const cacheKey = `${todayStr}_${lat}_${lon}`;

        if (cache[cacheKey]) return res.json(cache[cacheKey]);

        const jour    = String(today.getDate()).padStart(2,'0');
        const mois    = String(today.getMonth()+1).padStart(2,'0');
        const annee   = today.getFullYear();
        const dateStr = `${jour}-${mois}-${annee}`;

        const jourAn = Math.floor((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + 1;

        const [dataAladhan, hadith, doua] = await Promise.all([
            httpsGet(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=12`),
            fetchHadithDepuisListe(IDS_HADITHS_FR, jourAn),
            fetchHadithDepuisListe(IDS_DOUAS_FR, jourAn)
        ]);

        if (!dataAladhan || dataAladhan.code !== 200) {
            return res.json({
                date:'', fajr:'--:--', dhuhr:'--:--', asr:'--:--',
                maghrib:'--:--', isha:'--:--',
                hadithAr:'', hadithFr:'', hadithRef:'',
                douaAr:'', douaFr:'', douaRef:'',
                erreur: true
            });
        }

        const t = dataAladhan.data.timings;
        const dateLabel = today.toLocaleDateString('fr-FR', {
            weekday:'long', day:'numeric', month:'long', year:'numeric'
        });

        const result = {
            date     : dateLabel,
            fajr     : t.Fajr,
            dhuhr    : t.Dhuhr,
            asr      : t.Asr,
            maghrib  : t.Maghrib,
            isha     : t.Isha,
            hadithAr : hadith?.ar  || '',
            hadithFr : hadith?.fr  || '',
            hadithRef: hadith?.ref || '',
            douaAr   : doua?.ar   || '',
            douaFr   : doua?.fr   || '',
            douaRef  : doua?.ref  || ''
        };

        cache[cacheKey] = result;
        res.json(result);

    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
