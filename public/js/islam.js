// ===================== WIDGET ISLAM =====================

let islamData = null;

async function chargerIslam() {
    const el = document.getElementById('wc-islam');
    if (el) el.textContent = 'Chargement...';
    try {
        const r = await fetch('/api/islam');
        const d = await r.json();
        islamData = d;

        const prochaine = getProchainePreiere(d);

        if (el) {
            el.innerHTML = `
                <div class="islam-widget">
                    <div class="islam-prochaine">
                        <span class="islam-prochaine-label">Prochaine prière</span>
                        <span class="islam-prochaine-nom">${prochaine.nom}</span>
                        <span class="islam-prochaine-heure">${prochaine.heure}</span>
                    </div>
                    <div class="islam-prieres-row">
                        ${renderMiniPriere('Fajr',    d.fajr,    prochaine.nom)}
                        ${renderMiniPriere('Dhuhr',   d.dhuhr,   prochaine.nom)}
                        ${renderMiniPriere('Asr',     d.asr,     prochaine.nom)}
                        ${renderMiniPriere('Maghrib', d.maghrib, prochaine.nom)}
                        ${renderMiniPriere('Isha',    d.isha,    prochaine.nom)}
                    </div>
                    ${d.hadithFr ? `<div class="islam-hadith-apercu">"${d.hadithFr.split(' ').slice(0,12).join(' ')}..."</div>` : ''}
                </div>
            `;
        }
    } catch {
        if (el) el.innerHTML = '<div style="color:#9ca3af;font-size:13px;text-align:center">Horaires indisponibles</div>';
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
    const prieres = [
        { nom: 'Fajr',    heure: data.fajr    },
        { nom: 'Dhuhr',   heure: data.dhuhr   },
        { nom: 'Asr',     heure: data.asr     },
        { nom: 'Maghrib', heure: data.maghrib  },
        { nom: 'Isha',    heure: data.isha     },
    ];

    for (const p of prieres) {
        if (!p.heure || p.heure === '--:--') continue;
        const [h, m] = p.heure.split(':').map(Number);
        const dt = new Date();
        dt.setHours(h, m, 0, 0);
        if (dt > maintenant) return p;
    }
    return prieres[0];
}
