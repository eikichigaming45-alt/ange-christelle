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

const METEO_DESC = {
    0:'Ciel dégagé', 1:'Principalement dégagé', 2:'Partiellement nuageux',
    3:'Couvert', 45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine légère', 53:'Bruine', 55:'Bruine forte',
    61:'Pluie légère', 63:'Pluie modérée', 65:'Forte pluie',
    71:'Neige légère', 73:'Neige', 75:'Forte neige',
    80:'Averses légères', 81:'Averses', 82:'Fortes averses',
    95:'Orage', 96:'Orage avec grêle', 99:'Orage violent'
};

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

async function getNomVille(lat, lon) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
        const d = await r.json();
        return d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || 'Ma position';
    } catch { return 'Ma position'; }
}

async function chargerMeteo(lat, lon, nomVille) {
    const el = document.getElementById('wc-meteo');
    if (el) el.textContent = 'Chargement...';
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=6`;
        const r = await fetch(url);
        const d = await r.json();

        meteoData = {
            temp  : Math.round(d.current.temperature_2m),
            code  : d.current.weather_code,
            icon  : METEO_ICONS[d.current.weather_code] || '🌡️',
            vent  : Math.round(d.current.wind_speed_10m),
            hum   : d.current.relative_humidity_2m,
            pluie : d.current.precipitation_probability || 0,
            max   : Math.round(d.daily.temperature_2m_max[0]),
            min   : Math.round(d.daily.temperature_2m_min[0]),
            ville : nomVille,
            lat, lon,
            daily : d.daily
        };

        _renderWidget();

        const user = getUser();
        fetch('/api/profil/meteo-ville', {
            method : 'PATCH',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify({ lat, lon, ville: nomVille })
        }).catch(() => {});

    } catch { if (el) el.textContent = 'Météo non disponible'; }
}

function _renderWidget() {
    const el = document.getElementById('wc-meteo');
    if (!el || !meteoData) return;
    const d = meteoData;

    const now       = new Date();
    const dateLabel = now.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const dateCap   = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

    const joursHTML = d.daily.time.slice(0, 5).map((tj, i) => {
        const jObj  = new Date(tj + 'T12:00:00');
        const jour  = i === 0 ? 'Auj.' : JOURS_COURT[jObj.getDay()];
        const jMax  = Math.round(d.daily.temperature_2m_max[i]);
        const jMin  = Math.round(d.daily.temperature_2m_min[i]);
        const jIcon = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:1px;
                        padding:5px 0;border-radius:8px;flex:1;min-width:0">
                <div style="font-size:9px;font-weight:700;color:#888">${jour}</div>
                <div style="font-size:16px;line-height:1.2">${jIcon}</div>
                <div style="font-size:11px;font-weight:700;color:#333">${jMax}°</div>
                <div style="font-size:10px;color:#aaa">${jMin}°</div>
            </div>`;
    }).join('');

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div>
                    <div style="font-size:38px;font-weight:800;color:#1e3a5f;line-height:1">${d.temp}°</div>
                    <div style="font-size:12px;color:#555;margin-top:2px">${d.icon} ${METEO_DESC[d.code] || 'Variable'}</div>
                    <div style="font-size:11px;color:#888">↑${d.max}° ↓${d.min}°</div>
                    <div style="font-size:11px;color:#e879a0;margin-top:2px;font-weight:600">📍 ${d.ville}</div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:2px">${dateCap}</div>
                </div>
                <div style="font-size:44px;line-height:1">${d.icon}</div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
                <span class="meteo-badge">💧 ${d.hum}%</span>
                <span class="meteo-badge">💨 ${d.vent} km/h</span>
                <span class="meteo-badge">🌧️ ${d.pluie}%</span>
            </div>
            <div style="display:flex;gap:4px;width:100%">${joursHTML}</div>
        </div>
    `;
}

function _renderModaleMeteo(selectedIdx) {
    const body = document.getElementById('modal-body');
    if (!body || !meteoData) {
        if (body) body.innerHTML = `
            <p style="color:#555;margin-bottom:16px">Météo non disponible.</p>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
        `;
        return;
    }
    const d = meteoData;

    const t         = d.daily.time[selectedIdx];
    const dateObj   = new Date(t + 'T12:00:00');
    const dateLabel = selectedIdx === 0
        ? "Aujourd'hui"
        : dateObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    const iMax    = Math.round(d.daily.temperature_2m_max[selectedIdx]);
    const iMin    = Math.round(d.daily.temperature_2m_min[selectedIdx]);
    const iIcon   = METEO_ICONS[d.daily.weather_code[selectedIdx]] || '🌡️';
    const iPluie  = d.daily.precipitation_probability_max?.[selectedIdx] || 0;
    const desc    = METEO_DESC[d.daily.weather_code[selectedIdx]] || 'Variable';
    const isToday = selectedIdx === 0;

    const joursHTML = d.daily.time.slice(0, 6).map((tj, i) => {
        const jObj  = new Date(tj + 'T12:00:00');
        const jour  = i === 0 ? 'Auj.' : JOURS_COURT[jObj.getDay()];
        const jMax  = Math.round(d.daily.temperature_2m_max[i]);
        const jMin  = Math.round(d.daily.temperature_2m_min[i]);
        const jIcon = METEO_ICONS[d.daily.weather_code[i]] || '🌡️';
        const sel   = i === selectedIdx;
        return `
            <div onclick="_selectJourModale(${i})" style="
                display:flex;flex-direction:column;align-items:center;gap:2px;
                padding:8px 4px;border-radius:10px;cursor:pointer;flex:1;min-width:0;
                background:${sel ? '#eff6ff' : '#f8fafc'};
                border:2px solid ${sel ? '#4f46e5' : '#e5e7eb'};
                transition:all .15s">
                <div style="font-size:10px;font-weight:700;color:${sel ? '#4f46e5' : '#888'}">${jour}</div>
                <div style="font-size:20px;line-height:1.3">${jIcon}</div>
                <div style="font-size:12px;font-weight:700;color:#1e3a5f">${jMax}°</div>
                <div style="font-size:11px;color:#aaa">${jMin}°</div>
            </div>`;
    }).join('');

    body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        background:#f0f9ff;border-radius:16px;padding:16px 20px">
                <div>
                    <div style="font-size:54px;font-weight:900;color:#1e3a5f;line-height:1">
                        ${isToday ? d.temp : iMax}°
                    </div>
                    <div style="font-size:14px;color:#555;margin-top:4px">${iIcon} ${desc}</div>
                    <div style="font-size:13px;color:#888;margin-top:2px">↑${iMax}° ↓${iMin}°</div>
                    <div style="font-size:12px;color:#e879a0;margin-top:4px;font-weight:600">📍 ${d.ville}</div>
                </div>
                <div style="font-size:64px;line-height:1">${iIcon}</div>
            </div>
            ${isToday ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="meteo-badge" style="font-size:13px;padding:6px 12px">💧 ${d.hum}%</span>
                <span class="meteo-badge" style="font-size:13px;padding:6px 12px">💨 ${d.vent} km/h</span>
                <span class="meteo-badge" style="font-size:13px;padding:6px 12px">🌧️ ${d.pluie}%</span>
            </div>` : ''}
            <div>
                <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                            letter-spacing:.5px;margin-bottom:8px">Prévisions 6 jours</div>
                <div style="display:flex;gap:6px">${joursHTML}</div>
            </div>
            <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:14px;padding:16px">
                <div style="font-size:13px;font-weight:700;color:#0369a1;
                            text-transform:capitalize;margin-bottom:10px">${dateLabel}</div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-size:13px;color:#555;margin-bottom:6px">${iIcon} ${desc}</div>
                        <div style="font-size:26px;font-weight:800;color:#1e3a5f">↑${iMax}° ↓${iMin}°</div>
                        <div style="margin-top:8px">
                            <span class="meteo-badge">🌧️ Précipitations : ${iPluie}%</span>
                        </div>
                    </div>
                    <div style="font-size:52px;line-height:1">${iIcon}</div>
                </div>
            </div>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>
        </div>
    `;
}

window._selectJourModale = function(idx) {
    _renderModaleMeteo(idx);
};

window._ouvrirModaleMeteo = function() {
    _renderModaleMeteo(0);
};

function afficherDetailJourModale(i) {
    _renderModaleMeteo(i);
}

async function chargerMeteoAuto() {
    if (profilCache?.meteo_lat && profilCache?.meteo_lon) {
        chargerMeteo(profilCache.meteo_lat, profilCache.meteo_lon, profilCache.meteo_ville || 'Ma ville');
        return;
    }
    try {
        const user = getUser();
        if (user?.token) {
            const r = await fetch('/api/profil', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const d = await r.json();
            if (d.profil?.meteo_lat && d.profil?.meteo_lon) {
                profilCache = d.profil;
                chargerMeteo(d.profil.meteo_lat, d.profil.meteo_lon, d.profil.meteo_ville || 'Ma ville');
                return;
            }
        }
    } catch { /* fallback géoloc */ }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
                chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville);
            },
            () => chargerMeteo(48.8566, 2.3522, 'Paris')
        );
    } else { chargerMeteo(48.8566, 2.3522, 'Paris'); }
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
                <p style="color:#ef4444;margin-bottom:16px">Aucune ville trouvée.</p>
                <div class="ville-form">
                    <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                    <button onclick="rechercherVille()">OK</button>
                </div>
                <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>`;
        }
    } catch {
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#ef4444;margin-bottom:16px">Erreur réseau.</p>
            <div class="ville-form">
                <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                <button onclick="rechercherVille()">OK</button>
            </div>
            <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>`;
    }
}

async function geoLocaliser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async pos => {
            const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
            await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville);
            closeModal();
        },
        () => {
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;margin-bottom:16px">Localisation refusée.</p>
                <div class="ville-form">
                    <input type="text" id="ville-input" placeholder="Rechercher une ville...">
                    <button onclick="rechercherVille()">OK</button>
                </div>
                <button class="geo-btn" onclick="geoLocaliser()">📍 Utiliser ma position</button>`;
        }
    );
}
// ============================================================
