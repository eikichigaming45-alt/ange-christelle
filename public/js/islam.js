// ===================== WIDGET ISLAM =====================

let islamData = null;

async function chargerIslam() {
    const el = document.getElementById('wc-islam');
    if (el) el.textContent = 'Chargement...';

    try {
        // Géolocalisation → Aladhan
        const position = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        const { latitude, longitude } = position.coords;
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

        const [rPrieres, rHadith] = await Promise.all([
            fetch(`https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=2`),
            fetch('https://api.hadith.gading.dev/books/muslim/1')
        ]);

        const dPrieres = await rPrieres.json();
        const dHadith  = await rHadith.json();

        const timings = dPrieres?.data?.timings;
        const hadith  = dHadith?.data?.hadiths?.[0];

        islamData = {
            fajr    : timings?.Fajr    || '--:--',
            dhuhr   : timings?.Dhuhr   || '--:--',
            asr     : timings?.Asr     || '--:--',
            maghrib : timings?.Maghrib  || '--:--',
            isha    : timings?.Isha     || '--:--',
            date    : dPrieres?.data?.date?.readable || '',
            hadith  : hadith?.arab || '',
            hadithFr: hadith?.translation?.fr || hadith?.translation?.id || '',
            numero  : hadith?.number || ''
        };

        // Prière suivante
        const prochaineLabel = getProchainePreiere(islamData);

        if (el) {
            el.innerHTML = `
                <div class="islam-widget">
                    <div class="islam-prochaine">
                        <span class="islam-prochaine-label">Prochaine prière</span>
                        <span class="islam-prochaine-nom">${prochaineLabel.nom}</span>
                        <span class="islam-prochaine-heure">${prochaineLabel.heure}</span>
                    </div>
                    <div class="islam-prieres-row">
                        ${renderMiniPriere('Fajr',    islamData.fajr,    prochaineLabel.nom)}
                        ${renderMiniPriere('Dhuhr',   islamData.dhuhr,   prochaineLabel.nom)}
                        ${renderMiniPriere('Asr',     islamData.asr,     prochaineLabel.nom)}
                        ${renderMiniPriere('Maghrib', islamData.maghrib,  prochaineLabel.nom)}
                        ${renderMiniPriere('Isha',    islamData.isha,     prochaineLabel.nom)}
                    </div>
                    ${islamData.hadithFr ? `<div class="islam-hadith-apercu">"${islamData.hadithFr.split(' ').slice(0,12).join(' ')}..."</div>` : ''}
                </div>
            `;
        }

    } catch(err) {
        // Fallback sans géoloc : Chécy (45430)
        try {
            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
            const r = await fetch(`https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=Checy&country=France&method=2`);
            const d = await r.json();
            const timings = d?.data?.timings;

            islamData = {
                fajr    : timings?.Fajr    || '--:--',
                dhuhr   : timings?.Dhuhr   || '--:--',
                asr     : timings?.Asr     || '--:--',
                maghrib : timings?.Maghrib  || '--:--',
                isha    : timings?.Isha     || '--:--',
                date    : d?.data?.date?.readable || '',
                hadith  : '',
                hadithFr: '',
                numero  : ''
            };

            const prochaineLabel = getProchainePreiere(islamData);

            if (el) {
                el.innerHTML = `
                    <div class="islam-widget">
                        <div class="islam-prochaine">
                            <span class="islam-prochaine-label">Prochaine prière</span>
                            <span class="islam-prochaine-nom">${prochaineLabel.nom}</span>
                            <span class="islam-prochaine-heure">${prochaineLabel.heure}</span>
                        </div>
                        <div class="islam-prieres-row">
                            ${renderMiniPriere('Fajr',    islamData.fajr,    prochaineLabel.nom)}
                            ${renderMiniPriere('Dhuhr',   islamData.dhuhr,   prochaineLabel.nom)}
                            ${renderMiniPriere('Asr',     islamData.asr,     prochaineLabel.nom)}
                            ${renderMiniPriere('Maghrib', islamData.maghrib,  prochaineLabel.nom)}
                            ${renderMiniPriere('Isha',    islamData.isha,     prochaineLabel.nom)}
                        </div>
                    </div>
                `;
            }
        } catch {
            islamData = null;
            if (el) el.innerHTML = '<div style="color:#9ca3af;font-size:13px;text-align:center">Horaires indisponibles</div>';
        }
    }
}

function renderMiniPriere(nom, heure, prochaineNom) {
    const actif = nom === prochaineNom;
    return `
        <div class="islam-mini-priere ${actif ? 'islam-mini-actif' : ''}">
            <span class="islam-mini-nom">${nom}</span>
            <span class="islam-mini-heure">${heure}</span>
        </div>
    `;
}

function getProchainePreiere(data) {
    const maintenant = new Date();
    const hM = (str) => {
        if (!str || str === '--:--') return null;
        const [h, m] = str.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    };

    const prieres = [
        { nom: 'Fajr',    heure: data.fajr,    dt: hM(data.fajr)    },
        { nom: 'Dhuhr',   heure: data.dhuhr,   dt: hM(data.dhuhr)   },
        { nom: 'Asr',     heure: data.asr,      dt: hM(data.asr)     },
        { nom: 'Maghrib', heure: data.maghrib,  dt: hM(data.maghrib) },
        { nom: 'Isha',    heure: data.isha,     dt: hM(data.isha)    },
    ];

    const prochaine = prieres.find(p => p.dt && p.dt > maintenant);
    return prochaine || prieres[0]; // Si toutes passées → Fajr du lendemain
}
