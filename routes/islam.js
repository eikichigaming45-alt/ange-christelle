const express = require('express');
const router  = express.Router();

// Coordonnées fixes Chécy (45430)
const LAT = 47.9167;
const LON = 1.9167;

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

function calculerHoraires(date) {
    const annee  = date.getFullYear();
    const mois   = date.getMonth() + 1;
    const jour   = date.getDate();

    // Numéro du jour dans l'année
    const N = Math.floor(275 * mois / 9) - Math.floor((mois + 9) / 12) *
              (1 + Math.floor((annee % 4 === 0 && (annee % 100 !== 0 || annee % 400 === 0) ? 1 : 0))) +
              jour - 30;

    const L0 = 280.46646 + 36000.76983 * ((N - 1) / 36525);
    const M  = toRad(357.52911 + 35999.05029 * ((N - 1) / 36525));
    const e  = 0.016708634;
    const C  = (1.9146 - 0.004817 * ((N-1)/36525)) * Math.sin(M) +
               0.019993 * Math.sin(2*M);
    const sunLon = toRad(L0 + C);
    const obliq  = toRad(23.439 - 0.0000004 * N);
    const sinDec = Math.sin(obliq) * Math.sin(sunLon);
    const dec    = Math.asin(sinDec);

    // Équation du temps (minutes)
    const B   = toRad(360 / 365 * (N - 81));
    const EqT = 9.87 * Math.sin(2*B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

    // Midi solaire (heure locale UTC+2 en été, UTC+1 en hiver)
    const estEte = date.getTimezoneOffset() === -120; // France été
    const offsetUTC = estEte ? 2 : 1;
    const midiSolaire = 12 - (LON / 15 - offsetUTC) - EqT / 60;

    // Angles horaires pour chaque prière
    function angleToHeure(angle) {
        const cosH = (Math.cos(toRad(angle)) - Math.sin(toRad(LAT)) * sinDec) /
                     (Math.cos(toRad(LAT)) * Math.cos(dec));
        if (Math.abs(cosH) > 1) return null;
        return toDeg(Math.acos(cosH)) / 15;
    }

    const hFajr    = angleToHeure(-18); // angle dépression Fajr
    const hSunrise = angleToHeure(-0.833);
    const hAsr     = (() => {
        // Méthode standard : ombre = longueur objet + longueur ombre midi
        const altitudeMidi = toDeg(Math.asin(Math.sin(toRad(LAT)) * sinDec +
                             Math.cos(toRad(LAT)) * Math.cos(dec)));
        const asrAngle = toDeg(Math.atan(1 / (1 + Math.tan(toRad(Math.abs(LAT - toDeg(dec)))))));
        const cosHasr  = (Math.sin(toRad(asrAngle)) - Math.sin(toRad(LAT)) * sinDec) /
                         (Math.cos(toRad(LAT)) * Math.cos(dec));
        if (Math.abs(cosHasr) > 1) return null;
        return toDeg(Math.acos(cosHasr)) / 15;
    })();
    const hMaghrib = angleToHeure(-0.833);
    const hIsha    = angleToHeure(-17);

    function fmt(h) {
        if (h === null) return '--:--';
        const totalMin = Math.round(h * 60);
        const hh = Math.floor(totalMin / 60) % 24;
        const mm = totalMin % 60;
        return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    }

    return {
        fajr    : hFajr    !== null ? fmt(midiSolaire - hFajr)    : '--:--',
        sunrise : hSunrise !== null ? fmt(midiSolaire - hSunrise) : '--:--',
        dhuhr   : fmt(midiSolaire),
        asr     : hAsr     !== null ? fmt(midiSolaire + hAsr)     : '--:--',
        maghrib : hMaghrib !== null ? fmt(midiSolaire + hMaghrib) : '--:--',
        isha    : hIsha    !== null ? fmt(midiSolaire + hIsha)    : '--:--',
    };
}

let cache = null;
let cacheDate = null;

router.get('/', async (req, res) => {
    try {
        const today    = new Date();
        const todayStr = today.toISOString().split('T')[0];

        if (cache && cacheDate === todayStr) return res.json(cache);

        const horaires = calculerHoraires(today);

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
            fajr     : horaires.fajr,
            dhuhr    : horaires.dhuhr,
            asr      : horaires.asr,
            maghrib  : horaires.maghrib,
            isha     : horaires.isha,
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
