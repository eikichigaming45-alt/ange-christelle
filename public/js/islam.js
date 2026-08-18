(function () {
    const FALLBACK = { lat: 48.8566, lon: 2.3522 }; // Paris

    function getHeure(hhmm) {
        if (!hhmm) return null;
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    function prochaineP(data) {
        const maintenant = new Date();
        const now = maintenant.getHours() * 60 + maintenant.getMinutes();
        const prieres = [
            { nom: 'Fajr',    heure: data.fajr },
            { nom: 'Dhuhr',   heure: data.dhuhr },
            { nom: 'Asr',     heure: data.asr },
            { nom: 'Maghrib', heure: data.maghrib },
            { nom: 'Isha',    heure: data.isha }
        ];
        for (const p of prieres) {
            if (getHeure(p.heure) > now) return p;
        }
        return prieres[0]; // Fajr du lendemain
    }

    function afficherWidget(data) {
        const prochaine = prochaineP(data);
        const widget = document.getElementById('widget-islam');
        if (!widget) return;
        widget.innerHTML = `
            <div style="background:#1a7a4a;color:#fff;border-radius:10px;padding:12px;text-align:center;margin-bottom:12px;">
                <div style="font-size:11px;text-transform:uppercase;opacity:.8;letter-spacing:1px;">Prochaine prière</div>
                <div style="font-size:22px;font-weight:700;">${prochaine.nom}</div>
                <div style="font-size:32px;font-weight:800;">${prochaine.heure}</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;">
                ${['Fajr','Dhuhr','Asr','Maghrib','Isha'].map(n => {
                    const h = data[n.toLowerCase()];
                    const actif = n === prochaine.nom;
                    return `<div style="text-align:center;${actif?'color:#1a7a4a;font-weight:700;':''}" >
                        <div>${n}</div><div>${h}</div>
                    </div>`;
                }).join('')}
            </div>
            <div style="border-left:3px solid #1a7a4a;padding-left:8px;font-style:italic;font-size:12px;color:#555;">
                "${data.hadithFr?.substring(0,80)}..."
            </div>`;
    }

    function afficherModale(data) {
        const prochaine = prochaineP(data);
        return `
            <p style="text-align:center;color:#888;font-size:13px;margin-bottom:16px;">${data.date}</p>
            <div style="background:#f0faf4;border-radius:10px;padding:16px;margin-bottom:16px;">
                <div style="color:#1a7a4a;font-weight:700;font-size:12px;text-transform:uppercase;margin-bottom:10px;">Horaires des prières</div>
                ${[
                    ['Fajr (Aube)',     data.fajr],
                    ['Dhuhr (Midi)',    data.dhuhr],
                    ['Asr (Après-midi)',data.asr],
                    ['Maghrib (Coucher)',data.maghrib],
                    ['Isha (Nuit)',     data.isha]
                ].map(([nom, h]) => {
                    const estProchaine = nom.startsWith(prochaine.nom);
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e0f0e8;">
                        <span style="color:#333;">${nom}</span>
                        <span style="color:#1a7a4a;font-weight:700;">${h}
                            ${estProchaine ? '<span style="background:#1a7a4a;color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">Prochaine</span>' : ''}
                        </span>
                    </div>`;
                }).join('')}
            </div>
            <div style="background:#fffbea;border-radius:10px;padding:14px;margin-bottom:12px;">
                <div style="color:#b8860b;font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:8px;">Hadith du jour</div>
                <p style="font-style:italic;color:#444;margin:0 0 6px;">"${data.hadithFr}"</p>
                <p style="text-align:right;color:#888;font-size:11px;margin:0;">${data.hadithRef}</p>
            </div>
            <div style="background:#f5f0ff;border-radius:10px;padding:14px;">
                <div style="color:#6a0dad;font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:8px;">Invocation (Doua)</div>
                <p style="font-family:serif;font-size:18px;text-align:right;direction:rtl;color:#333;margin:0 0 8px;">${data.hadithAr}</p>
                <p style="font-style:italic;color:#555;font-size:12px;margin:0;">"Ô Allah, je Te demande la guidance, la piété, la chasteté et l'aisance."</p>
            </div>`;
    }

    function chargerIslam(lat, lon) {
        const url = `/api/islam?lat=${lat}&lon=${lon}`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                afficherWidget(data);
                // Stocker pour la modale
                window._islamData = data;
            })
            .catch(() => {
                const w = document.getElementById('widget-islam');
                if (w) w.innerHTML = '<p style="color:#888;text-align:center;">Données indisponibles</p>';
            });
    }

    function init() {
        if (!document.getElementById('widget-islam')) return;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => chargerIslam(pos.coords.latitude, pos.coords.longitude),
                ()  => chargerIslam(FALLBACK.lat, FALLBACK.lon),
                { timeout: 5000 }
            );
        } else {
            chargerIslam(FALLBACK.lat, FALLBACK.lon);
        }
    }

    // Modale
    window.ouvrirModaleIslam = function () {
        const data = window._islamData;
        if (!data) return;
        const contenu = document.getElementById('modal-contenu');
        if (contenu) contenu.innerHTML = afficherModale(data);
        const modal = document.getElementById('modal');
        if (modal) modal.style.display = 'flex';
    };

    window.chargerIslam = chargerIslam;
    init();
})();
