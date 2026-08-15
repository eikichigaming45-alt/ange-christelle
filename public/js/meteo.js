// ===================== WIDGET METEO =====================

async function chargerMeteo(lat, lon, nomVille) {
    const el = document.getElementById('wc-meteo');
    if (el) el.textContent = 'Chargement...';
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=1`;
        const r = await fetch(url);
        const d = await r.json();
        const temp = Math.round(d.current.temperature_2m);
        const desc = codes[d.current.weather_code]||'Variable';
        const vent = Math.round(d.current.wind_speed_10m);
        const hum  = d.current.relative_humidity_2m;
        const max  = Math.round(d.daily.temperature_2m_max[0]);
        const min  = Math.round(d.daily.temperature_2m_min[0]);
        meteoData = {temp,desc,vent,hum,max,min,ville:nomVille,lat,lon};
        if (el) el.textContent = `${nomVille} — ${desc} — ${temp}°C`;
        localStorage.setItem('myvibe_ville', JSON.stringify({lat,lon,ville:nomVille}));
    } catch { if (el) el.textContent = 'Météo non disponible'; }
}

function chargerMeteoAuto() {
    const saved = localStorage.getItem('myvibe_ville');
    if (saved) { const v = JSON.parse(saved); chargerMeteo(v.lat,v.lon,v.ville); return; }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => chargerMeteo(pos.coords.latitude,pos.coords.longitude,'Ma position'),
            () => chargerMeteo(48.8566,2.3522,'Paris')
        );
    } else { chargerMeteo(48.8566,2.3522,'Paris'); }
}

async function rechercherVille() {
    const ville = document.getElementById('ville-input').value.trim();
    if (!ville) return;
    try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr`);
        const d = await r.json();
        if (d.results?.length > 0) {
            const res = d.results[0];
            await chargerMeteo(res.latitude, res.longitude, res.name);
            closeModal();
        } else { alert('Ville introuvable.'); }
    } catch { alert('Erreur de recherche.'); }
}

function geoLocaliser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => { chargerMeteo(pos.coords.latitude,pos.coords.longitude,'Ma position'); closeModal(); },
            () => alert('Géolocalisation refusée.')
        );
    }
}
