// ============================================================
// public/js/islam.js
// Widget Prière Islam — horaires Aladhan + hadith HadeethEnc.
// Si islam_coords absent : tente les coords météo du profil.
// Si aucune coords dispo : bandeau + bouton Compléter le profil.
// ============================================================

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
        } catch (e) {}
        return null;
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
                <div style="font-size:11px;opacity:.75;margin-top:4px;">📍 ${coords?.ville || 'Ma position'}</div>
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

    function afficherBandeauProfil() {
        const w = document.getElementById('wc-islam');
        if (!w) return;
        w.innerHTML = `
            <div class="sante-alerte">
                ⚠️ Indique ta ville pour afficher les horaires de prière.
                <br><button class="ta-banner-btn" style="margin-top:8px" onclick="ouvrirMonProfil()">Compléter le profil</button>
            </div>`;
    }

    async function obtenirCoordsDepuisProfil() {
        try {
            const user = (typeof getUser === 'function') ? getUser() : null;
            if (!user?.token) return null;
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (!d.success || !d.profil) return null;
            const p = d.profil;
            if (p.meteo_lat && p.meteo_lon) {
                const coords = {
                    lat  : parseFloat(p.meteo_lat),
                    lon  : parseFloat(p.meteo_lon),
                    ville: p.meteo_ville || 'Ma position'
                };
                try {
                    localStorage.setItem('islam_coords', JSON.stringify(coords));
                } catch (e) {}
                return coords;
            }
        } catch (e) {}
        return null;
    }

    async function chargerIslam(rafraichirModale = false) {
        let coords = getCoords();

        if (!coords) {
            coords = await obtenirCoordsDepuisProfil();
        }

        if (!coords) {
            afficherBandeauProfil();
            return;
        }

        fetch(`/api/islam?lat=${coords.lat}&lon=${coords.lon}`)
            .then(r => r.json())
            .then(data => {
                window._islamData = data;
                afficherWidget(data);
                if (rafraichirModale) {
                    const overlay = document.getElementById('overlay');
                    if (overlay && overlay.classList.contains('on')) {
                        if (typeof openModal === 'function') openModal('islam');
                    }
                }
            })
            .catch(() => {
                const w = document.getElementById('wc-islam');
                if (w) w.innerHTML = '<p style="color:#888;text-align:center;">Données indisponibles</p>';
            });
    }

    window._islamChangerVille = function () {
        const form = document.getElementById('islam-ville-form');
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };

    window._islamGeolocate = function () {
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
                if (msg) { msg.style.color = '#059669'; msg.textContent = `Position enregistrée : ${ville}`; }
                window._islamData = null;
                chargerIslam(true);
            } catch (e) {
                if (msg) msg.textContent = 'Erreur de géolocalisation.';
            }
        }, () => {
            if (msg) msg.textContent = 'Permission refusée.';
        });
    };

    window._islamRechercherVille = async function () {
        const input = document.getElementById('islam-ville-input');
        const msg   = document.getElementById('islam-ville-msg');
        if (!input?.value.trim()) return;
        if (msg) msg.textContent = 'Recherche...';
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input.value)}&format=json&limit=1`);
            const d = await r.json();
            if (!d.length) { if (msg) msg.textContent = 'Ville introuvable.'; return; }
            const lat   = parseFloat(d[0].lat);
            const lon   = parseFloat(d[0].lon);
            const ville = d[0].display_name.split(',')[0];
            localStorage.setItem('islam_coords', JSON.stringify({ lat, lon, ville }));
            if (msg) { msg.style.color = '#059669'; msg.textContent = `Enregistré : ${ville}`; }
            window._islamData = null;
            chargerIslam(true);
        } catch (e) {
            if (msg) msg.textContent = 'Erreur de recherche.';
        }
    };

    window.chargerIslam = chargerIslam;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => chargerIslam());
    } else {
        chargerIslam();
    }

})();
