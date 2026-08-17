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

// Résolution coordonnées → nom de ville via API de géocodage inversé
async function getNomVille(lat, lon) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
        const d = await r.json();
        return d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || 'Ma position';
    } catch {
        return 'Ma position';
    }
}

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
                <div class="meteo-7j" style="justify-content:center">
                    ${d.daily.time.slice(0, 5).map((t, i) => {
                        const jour = i === 0 ? 'Auj.' : JOURS_COURT[new Date(t + 'T12:00:00').getDay()];
                        const iMax  = Math.round(d.daily.temperature_2m_max[i]);
                        const iMin  = Math.round(d.daily.temperature_2m_min[i]);
                        const iIcon = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
                        return `
                            <div class="meteo-jour ${i === 0 ? 'meteo-jour-today' : ''}">
                                <div class="meteo-jour-nom">${jour}</div>
                                <div class="meteo-jour-icon">${iIcon}</div>
                                <div class="meteo-jour-max">${iMax}°</div>
                                <div class="meteo-jour-min">${iMin}°</div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
        `;

        localStorage.setItem('myvibe_ville', JSON.stringify({ lat, lon, ville: nomVille }));
    } catch { if (el) el.textContent = 'Météo non disponible'; }
}

async function chargerMeteoAuto() {
    const saved = localStorage.getItem('myvibe_ville');
    if (saved) {
        const v = JSON.parse(saved);
        chargerMeteo(v.lat, v.lon, v.ville);
        return;
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const lat  = pos.coords.latitude;
                const lon  = pos.coords.longitude;
                const ville = await getNomVille(lat, lon);
                chargerMeteo(lat, lon, ville);
            },
            () => chargerMeteo(48.8566, 2.3522, 'Paris')
        );
    } else {
        chargerMeteo(48.8566, 2.3522, 'Paris');
    }
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
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Aucune ville trouvée.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="openModal('meteo')">Retour</button>
                </div>`;
        }
    } catch {
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur réseau.</p>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="openModal('meteo')">Retour</button>
            </div>`;
    }
}

async function geoLocaliser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const lat   = pos.coords.latitude;
            const lon   = pos.coords.longitude;
            // Efface la ville sauvegardée pour forcer la résolution du nom
            localStorage.removeItem('myvibe_ville');
            const ville = await getNomVille(lat, lon);
            await chargerMeteo(lat, lon, ville);
            closeModal();
        },
        () => {
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Localisation refusée par le navigateur.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="openModal('meteo')">Retour</button>
                </div>`;
        }
    );
}

// Appelée depuis modal.js quand on clique sur un jour
function afficherDetailJour(i) {
    const d = meteoData;
    if (!d?.daily) return;

    // Encadrer le jour sélectionné, désencadrer les autres
    document.querySelectorAll('.meteo-jour').forEach((el, idx) => {
        el.style.outline      = idx === i ? '2px solid #4f46e5' : 'none';
        el.style.outlineOffset = '2px';
        el.style.borderRadius  = '10px';
        el.classList.toggle('meteo-jour-selected', idx === i);
    });

    const t      = d.daily.time[i];
    const dateObj = new Date(t + 'T12:00:00');
    const date   = dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
    const iMax   = Math.round(d.daily.temperature_2m_max[i]);
    const iMin   = Math.round(d.daily.temperature_2m_min[i]);
    const iIcon  = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
    const iPluie = d.daily.precipitation_probability_max?.[i] || 0;
    const desc   = codes[d.daily.weather_code[i]] || 'Variable';

    document.getElementById('meteo-detail-jour').innerHTML = `
        <div class="meteo-detail-jour" style="
            background:#f0f9ff;border-radius:14px;padding:16px;
            border:2px solid #bae6fd;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:13px;font-weight:700;color:#0369a1;text-transform:capitalize;margin-bottom:4px">
                        ${date}
                    </div>
                    <div style="font-size:13px;color:#555;margin-bottom:4px">${iIcon} ${desc}</div>
                    <div style="font-size:22px;font-weight:800;color:#1e3a5f">↑${iMax}° ↓${iMin}°</div>
                    <div style="margin-top:6px">
                        <span class="meteo-badge">🌧️ ${iPluie}%</span>
                    </div>
                </div>
                <div style="font-size:52px;line-height:1">${iIcon}</div>
            </div>
        </div>
    `;
}
