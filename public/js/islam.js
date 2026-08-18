(function () {
    'use strict';

    function getHeure(hhmm) {
        if (!hhmm) return null;
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }

    function prochaineP(data) {
        const now = new Date().getHours() * 60 + new Date().getMinutes();
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
        return prieres[0];
    }

    function getCoords() {
        try {
            const saved = localStorage.getItem('islam_coords');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return { lat: 48.8566, lon: 2.3522, ville: 'Paris' };
    }

    function afficherWidget(data) {
        const widget = document.getElementById('wc-islam');
        if (!widget) return;
        const prochaine = prochaineP(data);
        const coords = getCoords();
        widget.innerHTML = `
            <div style="background:#1a7a4a;color:#fff;border-radius:10px;padding:12px;text-align:center;margin-bottom:12px;">
                <div style="font-size:11px;text-transform:uppercase;opacity:.8;letter-spacing:1px;">Prochaine prière</div>
                <div style="font-size:22px;font-weight:700;">${prochaine.nom}</div>
                <div style="font-size:32px;font-weight:800;">${prochaine.heure}</div>
                <div style="font-size:11px;opacity:.75;margin-top:4px;">📍 ${coords.ville}</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;">
                ${['Fajr','Dhuhr','Asr','Maghrib','Isha'].map(n => {
                    const h = data[n.toLowerCase()];
                    const actif = n === prochaine.nom;
                    return `<div style="text-align:center;${actif ? 'color:#1a7a4a;font-weight:700;' : ''}">
                        <div>${n}</div><div>${h}</div>
                    </div>`;
                }).join('')}
            </div>
            <div style="border-left:3px solid #1a7a4a;padding-left:8px;font-style:italic;font-size:12px;color:#555;">
                "${(data.hadithFr || '').substring(0, 80)}..."
            </div>`;
    }

    function afficherModale(data) {
        const prochaine = prochaineP(data);
        const coords = getCoords();
        return `
            <p style="text-align:center;color:#888;font-size:13px;margin-bottom:8px;">${data.date || ''}</p>

            <div style="text-align:center;margin-bottom:16px;">
                <span style="font-size:12px;color:#059669;font-weight:600;">📍 ${coords.ville}</span>
                <button onclick="window._islamChangerVille()" style="margin-left:10px;background:#f0fdf4;border:1px solid #10b981;color:#059669;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">Changer</button>
            </div>

            <div style="background:#f0faf4;border-radius:10px;padding:16px;margin-bottom:16px;">
                <div style="color:#1a7a4a;font-weight:700;font-size:12px;text-transform:uppercase;margin-bottom:10px;">Horaires des prières</div>
                ${[
                    ['Fajr (Aube)',       data.fajr],
                    ['Dhuhr (Midi)',      data.dhuhr],
                    ['Asr (Après-midi)',  data.asr],
                    ['Maghrib (Coucher)', data.maghrib],
                    ['Isha (Nuit)',       data.isha]
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

            ${data.hadithFr ? `
            <div style="background:#fffbea;border-radius:10px;padding:14px;margin-bottom:12px;">
                <div style="color:#b8860b;font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:8px;">Hadith du jour</div>
                ${data.hadithAr ? `<p style="font-family:serif;font-size:16px;text-align:right;direction:rtl;color:#333;margin:0 0 8px;">${data.hadithAr}</p>` : ''}
                <p style="font-style:italic;color:#444;margin:0 0 6px;">"${data.hadithFr}"</p>
                <p style="text-align:right;color:#888;font-size:11px;margin:0;">${data.hadithRef || ''}</p>
            </div>` : ''}

            ${data.douaFr ? `
            <div style="background:#f5f0ff;border-radius:10px;padding:14px;">
                <div style="color:#6a0dad;font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:8px;">Invocation (Doua)</div>
                ${data.douaAr ? `<p style="font-family:serif;font-size:18px;text-align:right;direction:rtl;color:#333;margin:0 0 8px;">${data.douaAr}</p>` : ''}
                <p style="font-style:italic;color:#555;font-size:12px;margin:0;">"${data.douaFr}"</p>
                <p style="text-align:right;color:#888;font-size:11px;margin-top:6px;">${data.douaRef || ''}</p>
            </div>` : ''}

            <div id="islam-ville-form" style="display:none;margin-top:16px;background:#f8fafc;border-radius:10px;padding:14px;">
                <div style="font-weight:700;font-size:13px;color:#333;margin-bottom:10px;">Changer la localisation</div>
                <button onclick="window._islamGeolocate()" style="width:100%;padding:10px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">📍 Utiliser ma position GPS</button>
                <div style="display:flex;gap:8px;">
                    <input id="islam-ville-input" placeholder="Nom de la ville..." style="flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
                    <button onclick="window._islamRechercherVille()" style="padding:10px 14px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">OK</button>
                </div>
                <div id="islam-ville-msg" style="font-size:12px;color:#ef4444;margin-top:6px;min-height:16px;"></div>
            </div>`;
    }

    window._islamChangerVille = function() {
        const form = document.getElementById('islam-ville-form');
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };

    window._islamGeolocate = function() {
        const msg = document.getElementById('islam-ville-msg');
        if (!navigator.geolocation) {
            if (msg) msg.textContent = 'Géolocalisation non supportée.';
            return;
        }
        if (msg) msg.textContent = 'Localisation en cours...';
        navigator.geolocation.getCurrentPosition(async pos => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
                const d = await r.json();
                const ville = d.address?.city || d.address?.town || d.address?.village || 'Ma position';
                localStorage.setItem('islam_coords', JSON.stringify({ lat, lon, ville }));
                if (msg) msg.style.color = '#059669';
                if (msg) msg.textContent = `Position enregistrée : ${ville}`;
                window.chargerIslam();
            } catch(e) {
                if (msg) msg.textContent = 'Erreur de géolocalisation.';
            }
        }, () => {
            if (msg) msg.textContent = 'Permission refusée.';
        });
    };

    window._islamRechercherVille = async function() {
        const input = document.getElementById('islam-ville-input');
        const msg   = document.getElementById('islam-ville-msg');
        if (!input?.value.trim()) return;
        if (msg) msg.textContent = 'Recherche...';
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input.value)}&format=json&limit=1`);
            const d = await r.json();
            if (!d.length) { if (msg) msg.textContent = 'Ville introuvable.'; return; }
            const lat  = parseFloat(d[0].lat);
            const lon  = parseFloat(d[0].lon);
            const ville = d[0].display_name.split(',')[0];
            localStorage.setItem('islam_coords', JSON.stringify({ lat, lon, ville }));
            if (msg) msg.style.color = '#059669';
            if (msg) msg.textContent = `Enregistré : ${ville}`;
            window.chargerIslam();
        } catch(e) {
            if (msg) msg.textContent = 'Erreur de recherche.';
        }
    };

    function chargerIslam() {
        const coords = getCoords();
        fetch(`/api/islam?lat=${coords.lat}&lon=${coords.lon}`)
            .then(r => r.json())
            .then(data => {
                window._islamData = data;
                afficherWidget(data);
            })
            .catch(() => {
                const w = document.getElementById('wc-islam');
                if (w) w.innerHTML = '<p style="color:#888;text-align:center;">Données indisponibles</p>';
            });
    }

    window.chargerIslam = chargerIslam;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', chargerIslam);
    } else {
        chargerIslam();
    }

})();
