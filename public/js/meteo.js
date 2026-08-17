// ===================== WIDGET METEO =====================

const METEO_ICONS = {
    0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
    45:'🌫️', 48:'🌫️',
    51:'🌦️', 53:'🌦️', 55:'🌧️',
    61:'🌧️', 63:'🌧️', 65:'🌧️',
    71:'🌨️', 73:'🌨️', 75:'🌨️',
    80:'🌦️', 81:'🌧️', 82:'🌧️',
    95:'⛈️', 96:'⛈️', 99:'⛈️'
};

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

async function chargerMeteo(lat, lon, nomVille) {
    const el = document.getElementById('wc-meteo');
    if (el) el.textContent = 'Chargement...';
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=5`;
        const r = await fetch(url);
        const d = await r.json();

        const temp  = Math.round(d.current.temperature_2m);
        const code  = d.current.weather_code;
        const icon  = METEO_ICONS[code] || '🌡️';
        const vent  = Math.round(d.current.wind_speed_10m);
        const hum   = d.current.relative_humidity_2m;
        const pluie = d.current.precipitation_probability || 0;
        const max   = Math.round(d.daily.temperature_2m_max[0]);
        const min   = Math.round(d.daily.temperature_2m_min[0]);

        meteoData = { temp, icon, code, vent, hum, pluie, max, min, ville: nomVille, lat, lon, daily: d.daily };

        if (el) el.innerHTML = `
            <div class="meteo-widget">
                <div class="meteo-top">
                    <div class="meteo-left">
                        <div class="meteo-temp">${temp}°</div>
                        <div class="meteo-minmax">↑${max}° ↓${min}°</div>
                        <div class="meteo-ville">📍 ${nomVille}</div>
                    </div>
                    <div class="meteo-icon-big">${icon}</div>
                </div>
                <div class="meteo-badges">
                    <span class="meteo-badge">💧 ${hum}%</span>
                    <span class="meteo-badge">💨 ${vent} km/h</span>
                    <span class="meteo-badge">🌧️ ${pluie}%</span>
                </div>
                <div class="meteo-7j">
                    ${d.daily.time.slice(0, 5).map((t, i) => {
                        const jour = i === 0 ? 'Auj.' : JOURS_COURT[new Date(t + 'T12:00:00').getDay()];
                        const iMax = Math.round(d.daily.temperature_2m_max[i]);
                        const iMin = Math.round(d.daily.temperature_2m_min[i]);
                        const iIcon = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
                        return `
                            <div class="meteo-jour ${i === 0 ? 'meteo-jour-today' : ''}">
                                <div class="meteo-jour-nom">${jour}</div>
                                <div class="meteo-jour-icon">${iIcon}</div>
                                <div class="meteo-jour-max">${iMax}°</div>
                                <div class="meteo-jour-min">${iMin}°</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        localStorage.setItem('myvibe_ville', JSON.stringify({ lat, lon, ville: nomVille }));
    } catch { if (el) el.textContent = 'Météo non disponible'; }
}

function chargerMeteoAuto() {
    const saved = localStorage.getItem('myvibe_ville');
    if (saved) { const v = JSON.parse(saved); chargerMeteo(v.lat, v.lon, v.ville); return; }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => chargerMeteo(pos.coords.latitude, pos.coords.longitude, 'Ma position'),
            () => chargerMeteo(48.8566, 2.3522, 'Paris')
        );
    } else { chargerMeteo(48.8566, 2.3522, 'Paris'); }
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
        } else {
            document.getElementById('modal-title').textContent = 'Ville introuvable';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Aucune ville trouvée pour cette recherche.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>
            `;
        }
    } catch {
        document.getElementById('modal-title').textContent = 'Erreur réseau';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Impossible de contacter le service de recherche.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Fermer</button>
            </div>
        `;
    }
}

function geoLocaliser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => { chargerMeteo(pos.coords.latitude, pos.coords.longitude, 'Ma position'); closeModal(); },
            () => {
                document.getElementById('modal-title').textContent = 'Géolocalisation refusée';
                document.getElementById('modal-body').innerHTML = `
                    <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Autorisation de localisation refusée par le navigateur.</p>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                    </div>
                `;
            }
        );
    }
}
