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
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=6`;
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

        _renderWidget(meteoData, 0);
        localStorage.setItem('myvibe_ville', JSON.stringify({ lat, lon, ville: nomVille }));
    } catch {
        if (el) el.textContent = 'Météo non disponible';
    }
}

function _renderWidget(data, selectedIdx) {
    const el = document.getElementById('wc-meteo');
    if (!el) return;

    const joursHTML = data.daily.time.slice(0, 6).map((t, i) => {
        const jour    = i === 0 ? 'Auj.' : JOURS_COURT[new Date(t + 'T12:00:00').getDay()];
        const iMax    = Math.round(data.daily.temperature_2m_max[i]);
        const iMin    = Math.round(data.daily.temperature_2m_min[i]);
        const iIcon   = METEO_ICONS[data.daily.weather_code[i]] || '🌡️';
        const selected = i === selectedIdx;
        return `
            <div onclick="selectJourWidget(${i})" style="
                display:flex;flex-direction:column;align-items:center;gap:2px;
                padding:6px 8px;border-radius:10px;cursor:pointer;min-width:44px;flex:1;
                background:${selected ? '#4f46e522' : 'transparent'};
                border:2px solid ${selected ? '#4f46e5' : 'transparent'};
                transition:all .15s">
                <div style="font-size:10px;font-weight:700;color:${selected ? '#4f46e5' : '#888'}">${jour}</div>
                <div style="font-size:18px;line-height:1">${iIcon}</div>
                <div style="font-size:11px;font-weight:700;color:#333">${iMax}°</div>
                <div style="font-size:10px;color:#aaa">${iMin}°</div>
            </div>`;
    }).join('');

    // Détail du jour sélectionné
    const sd    = data.daily;
    const iPluie = sd.precipitation_probability_max?.[selectedIdx] || 0;
    const iMax  = Math.round(sd.temperature_2m_max[selectedIdx]);
    const iMin  = Math.round(sd.temperature_2m_min[selectedIdx]);
    const iIcon = METEO_ICONS[sd.weather_code[selectedIdx]] || '🌡️';
    const desc  = codes[sd.weather_code[selectedIdx]] || 'Variable';
    const t     = sd.time[selectedIdx];
    const dateLabel = selectedIdx === 0
        ? "Aujourd'hui"
        : new Date(t + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
            <!-- Ligne principale -->
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div>
                    <div style="font-size:42px;font-weight:800;color:#1e3a5f;line-height:1">${selectedIdx === 0 ? data.temp : iMax}°</div>
                    <div style="font-size:12px;color:#555;margin-top:2px">${iIcon} ${desc}</div>
                    <div style="font-size:12px;color:#888">↑${iMax}° ↓${iMin}°</div>
                    <div style="font-size:12px;color:#e879a0;margin-top:2px">📍 ${data.ville}</div>
                </div>
                <div style="font-size:52px;line-height:1">${iIcon}</div>
            </div>
            <!-- Badges -->
            ${selectedIdx === 0 ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span class="meteo-badge">💧 ${data.hum}%</span>
                <span class="meteo-badge">💨 ${data.vent} km/h</span>
                <span class="meteo-badge">🌧️ ${data.pluie}%</span>
            </div>` : `
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span class="meteo-badge">🌧️ ${iPluie}%</span>
                <span class="meteo-badge" style="background:#fef3c7;color:#92400e;text-transform:capitalize">${dateLabel}</span>
            </div>`}
            <!-- Prévisions jours -->
            <div style="display:flex;gap:4px;overflow-x:auto">${joursHTML}</div>
        </div>
    `;
}

window.selectJourWidget = function(idx) {
    if (!meteoData) return;
    _renderWidget(meteoData, idx);
};

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
                const lat   = pos.coords.latitude;
                const lon   = pos.coords.longitude;
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
    const ville = document.getElementById('ville-input')?.value?.trim();
    if (!ville) return;
    try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr`);
        const d = await r.json();
        if (d.results?.length > 0) {
            const res = d.results[0];
            await chargerMeteo(res.latitude, res.longitude, res.name);
            closeModal();
        } else {
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
            localStorage.removeItem('myvibe_ville');
            const ville = await getNomVille(lat, lon);
            await chargerMeteo(lat, lon, ville);
            closeModal();
        },
        () => {
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Localisation refusée.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="openModal('meteo')">Retour</button>
                </div>`;
        }
    );
}

// Appelée depuis modal.js
function afficherDetailJour(i) {
    const d = meteoData;
    if (!d?.daily) return;

    document.querySelectorAll('.meteo-jour').forEach((el, idx) => {
        el.style.outline       = idx === i ? '2px solid #4f46e5' : 'none';
        el.style.outlineOffset = '2px';
        el.style.background    = idx === i ? '#e0e7ff' : (idx === 0 ? '#e0f2fe' : '#f8fafc');
    });

    const t      = d.daily.time[i];
    const dateObj = new Date(t + 'T12:00:00');
    const date   = i === 0
        ? "Aujourd'hui"
        : dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
    const iMax   = Math.round(d.daily.temperature_2m_max[i]);
    const iMin   = Math.round(d.daily.temperature_2m_min[i]);
    const iIcon  = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
    const iPluie = d.daily.precipitation_probability_max?.[i] || 0;
    const desc   = codes[d.daily.weather_code[i]] || 'Variable';

    document.getElementById('meteo-detail-jour').innerHTML = `
        <div style="background:#f0f9ff;border-radius:14px;padding:16px;border:2px solid #bae6fd;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:13px;font-weight:700;color:#0369a1;text-transform:capitalize;margin-bottom:4px">${date}</div>
                    <div style="font-size:13px;color:#555;margin-bottom:6px">${iIcon} ${desc}</div>
                    <div style="font-size:24px;font-weight:800;color:#1e3a5f">↑${iMax}° ↓${iMin}°</div>
                    <div style="margin-top:8px">
                        <span class="meteo-badge">🌧️ Précipitations : ${iPluie}%</span>
                    </div>
                </div>
                <div style="font-size:56px;line-height:1">${iIcon}</div>
            </div>
        </div>
    `;
}
