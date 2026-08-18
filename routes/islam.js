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

router.get('/', async (req, res) => {
    try {
        const today    = new Date();
        const todayStr = today.toISOString().split('T')[0];
        if (cache && cacheDate === todayStr) return res.json(cache);

        const jour  = String(today.getDate()).padStart(2,'0');
        const mois  = String(today.getMonth()+1).padStart(2,'0');
        const annee = today.getFullYear();
        const dateStr = `${jour}-${mois}-${annee}`;

        // Coordonnées GPS Chécy — méthode 12 = UOIF (France)
        const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=47.9167&longitude=1.9167&method=12`;
        const data = await httpsGet(url);

        if (!data || data.code !== 200) {
            return res.json({
                date:'', fajr:'--:--', dhuhr:'--:--',
                asr:'--:--', maghrib:'--:--', isha:'--:--',
                hadithFr:'Allah est doux et Il aime la douceur en toute chose.',
                hadithRef:'Boukhari & Muslim', erreur: true
            });
        }

        const t = data.data.timings;
        const dateLabel = today.toLocaleDateString('fr-FR', {
            weekday:'long', day:'numeric', month:'long', year:'numeric'
        });

        const hadiths = [
            { fr: "Les actions ne valent que par leurs intentions.", ref: "Boukhari & Muslim" },
            { fr: "Nul d'entre vous ne croit vraiment tant qu'il n'aime pas pour son frère ce qu'il aime pour lui-même.", ref: "Boukhari & Muslim" },
            { fr: "Le musulman est celui dont les musulmans sont à l'abri de sa langue et de sa main.", ref: "Boukhari" },
            { fr: "Facilite et ne complique pas, annonce la bonne nouvelle et ne fais pas fuir.", ref: "Boukhari" },
            { fr: "La pudeur est une branche de la foi.", ref: "Boukhari & Muslim" },
            { fr: "Le meilleur d'entre vous est celui qui a le meilleur caractère.", ref: "Boukhari" },
            { fr: "Souris à ton frère, c'est une aumône.", ref: "Tirmidhi" },
            { fr: "Celui qui croit en Allah et au Jour dernier qu'il dise une bonne parole ou qu'il se taise.", ref: "Boukhari & Muslim" },
            { fr: "La force n'est pas dans la lutte physique, mais dans la maîtrise de soi lors de la colère.", ref: "Boukhari & Muslim" },
            { fr: "Cherchez la science du berceau jusqu'à la tombe.", ref: "Hadith" },
            { fr: "Allah est doux et Il aime la douceur en toute chose.", ref: "Boukhari & Muslim" },
            { fr: "Le meilleur des hommes est celui qui est le plus utile aux autres.", ref: "Hadith" },
            { fr: "Qui suit un chemin pour acquérir une connaissance, Allah lui facilite le chemin vers le Paradis.", ref: "Muslim" },
            { fr: "Ne méprise aucune bonne action, même si c'est accueillir ton frère avec un visage souriant.", ref: "Muslim" },
            { fr: "Celui qui ne remercie pas les gens ne remercie pas Allah.", ref: "Tirmidhi" },
            { fr: "L'aumône n'a jamais diminué une fortune.", ref: "Muslim" },
            { fr: "Sois dans ce monde comme un étranger ou un voyageur de passage.", ref: "Boukhari" },
            { fr: "Évite ce qui te fait douter au profit de ce qui ne te fait pas douter.", ref: "Tirmidhi" },
            { fr: "Allah n'est pas miséricordieux envers celui qui n'est pas miséricordieux envers les gens.", ref: "Boukhari & Muslim" },
            { fr: "La miséricorde n'est retirée que de celui qui est malheureux.", ref: "Tirmidhi" },
            { fr: "Répands le salut, nourris les affamés, et prie la nuit quand les gens dorment.", ref: "Ibn Majah" },
            { fr: "Le croyant fort est meilleur et plus aimé d'Allah que le croyant faible.", ref: "Muslim" },
            { fr: "Invoquez Allah en étant certains d'être exaucés.", ref: "Tirmidhi" },
            { fr: "Purifiez-vous car l'islam est fondé sur la pureté.", ref: "Hadith" },
            { fr: "Le paradis est sous les pieds des mères.", ref: "Nasai" },
            { fr: "Rends service à ton voisin et tu seras croyant.", ref: "Tirmidhi" },
            { fr: "Celui qui se lève le matin en sécurité, en bonne santé avec sa pitance quotidienne, c'est comme s'il avait le monde entier.", ref: "Tirmidhi" },
            { fr: "La meilleure prière après les prières obligatoires est la prière de la nuit.", ref: "Muslim" },
            { fr: "Faites le bien et vous trouverez le bien.", ref: "Hadith" },
            { fr: "L'humilité n'abaisse personne, au contraire, Allah élève celui qui est humble.", ref: "Muslim" }
        ];

        const hadith = hadiths[(today.getDate() - 1) % hadiths.length];

        cache = {
            date     : dateLabel,
            fajr     : t.Fajr,
            dhuhr    : t.Dhuhr,
            asr      : t.Asr,
            maghrib  : t.Maghrib,
            isha     : t.Isha,
            hadithFr : hadith.fr,
            hadithRef: hadith.ref
        };
        cacheDate = todayStr;
        res.json(cache);

    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
