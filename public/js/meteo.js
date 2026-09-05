// ============================================================
// public/js/meteo.js
// Widget Météo — Open-Meteo + Nominatim.
// Persistance localStorage : moadja_meteo_mode + moadja_meteo_coords
// Refresh manuel (bouton ↻) + auto toutes les 30 min.
// Refresh géoloc : re-demande position si mode=geoloc.
// Fallback : coords profil BDD → géoloc → Paris.
// FIX B2 : jeu complet d'icônes météo remplacé par des SVG inline
//          (le glyphe emoji 🌫️ s'affichait en carré glossy sur
//          certains appareils, incohérent avec le style plat des
//          autres icônes — tout le jeu est désormais harmonisé,
//          indépendant de la police emoji du système).
// ============================================================

// FIX B2 : jeu d'icônes météo en SVG inline, style plat cohérent (9 icônes)
const METEO_SVG = {
    soleil: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><circle cx="12" cy="12" r="5" fill="#fbbf24"/><g stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/></g></svg>',
    peuNuageux: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><circle cx="9" cy="9" r="4.5" fill="#fbbf24"/><path d="M17 18H8a3.2 3.2 0 0 1-.5-6.36A4.4 4.4 0 0 1 16 10.3a3.6 3.6 0 0 1 2.4 2.8 2.8 2.8 0 0 1-1.4 4.9z" fill="#cbd5e1"/></svg>',
    partNuageux: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><circle cx="8" cy="8" r="4" fill="#fbbf24"/><path d="M19 18H7a3.6 3.6 0 0 1-.6-7.15A5 5 0 0 1 16.2 9.3a4 4 0 0 1 2.7 3.1 3.2 3.2 0 0 1 0 5.6z" fill="#b0bec5"/></svg>',
    couvert: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M19 18H6a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 16 8.5a4.5 4.5 0 0 1 3 3.5 3.5 3.5 0 0 1 0 6z" fill="#94a3b8"/></svg>',
    brouillard: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 12H7a3.2 3.2 0 0 1-.5-6.36A4.6 4.6 0 0 1 15.6 4.3 3.7 3.7 0 0 1 18 12z" fill="#b0bec5"/><rect x="3" y="15" width="18" height="1.6" rx="0.8" fill="#90a4ae"/><rect x="5" y="18.4" width="14" height="1.6" rx="0.8" fill="#b0bec5"/></svg>',
    bruine: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 12H7a3.2 3.2 0 0 1-.5-6.36A4.6 4.6 0 0 1 15.6 4.3 3.7 3.7 0 0 1 18 12z" fill="#94a3b8"/><circle cx="9" cy="17" r="1" fill="#93c5fd"/><circle cx="13" cy="19" r="1" fill="#93c5fd"/><circle cx="17" cy="17" r="1" fill="#93c5fd"/></svg>',
    pluie: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 12H7a3.2 3.2 0 0 1-.5-6.36A4.6 4.6 0 0 1 15.6 4.3 3.7 3.7 0 0 1 18 12z" fill="#94a3b8"/><path d="M8 16c0 1-1.5 2-1.5 3.2A1.5 1.5 0 0 0 8 20.7 1.5 1.5 0 0 0 9.5 19.2C9.5 18 8 17 8 16z" fill="#60a5fa"/><path d="M13 16c0 1-1.5 2-1.5 3.2a1.5 1.5 0 0 0 3 0C14.5 18 13 17 13 16z" fill="#60a5fa"/><path d="M18 16c0 1-1.5 2-1.5 3.2a1.5 1.5 0 0 0 3 0C19.5 18 18 17 18 16z" fill="#60a5fa"/></svg>',
    neige: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 12H7a3.2 3.2 0 0 1-.5-6.36A4.6 4.6 0 0 1 15.6 4.3 3.7 3.7 0 0 1 18 12z" fill="#94a3b8"/><g stroke="#bfdbfe" stroke-width="1.4" stroke-linecap="round"><line x1="8" y1="15.5" x2="8" y2="19.5"/><line x1="6.2" y1="16.5" x2="9.8" y2="18.5"/><line x1="6.2" y1="18.5" x2="9.8" y2="16.5"/><line x1="13" y1="16.5" x2="13" y2="20.5"/><line x1="11.2" y1="17.5" x2="14.8" y2="19.5"/><line x1="11.2" y1="19.5" x2="14.8" y2="17.5"/><line x1="18" y1="15.5" x2="18" y2="19.5"/><line x1="16.2" y1="16.5" x2="19.8" y2="18.5"/><line x1="16.2" y1="18.5" x2="19.8" y2="16.5"/></g></svg>',
    orage: '<svg width="1em" height="1em" viewBox="0 0 24 24" style="vertical-align:-0.15em"><path d="M18 11H7a3.2 3.2 0 0 1-.5-6.36A4.6 4.6 0 0 1 15.6 3.3 3.7 3.7 0 0 1 18 11z" fill="#64748b"/><path d="M13 12l-4 6h3l-1 5 5-7h-3l1-4z" fill="#fbbf24"/></svg>'
};

const METEO_ICONS = {
    0: METEO_SVG.soleil, 1: METEO_SVG.peuNuageux, 2: METEO_SVG.partNuageux, 3: METEO_SVG.couvert,
    45: METEO_SVG.brouillard, 48: METEO_SVG.brouillard,
    51: METEO_SVG.bruine, 53: METEO_SVG.bruine, 55: METEO_SVG.pluie,
    56: METEO_SVG.pluie, 57: METEO_SVG.pluie,
    61: METEO_SVG.pluie, 63: METEO_SVG.pluie, 65: METEO_SVG.pluie,
    66: METEO_SVG.pluie, 67: METEO_SVG.pluie,
    71: METEO_SVG.neige, 73: METEO_SVG.neige, 75: METEO_SVG.neige, 77: METEO_SVG.neige,
    80: METEO_SVG.bruine, 81: METEO_SVG.pluie, 82: METEO_SVG.pluie,
    85: METEO_SVG.neige, 86: METEO_SVG.neige,
    95: METEO_SVG.orage, 96: METEO_SVG.orage, 99: METEO_SVG.orage
};

const METEO_DESC = {
    0:'Ciel dégagé', 1:'Principalement dégagé', 2:'Partiellement nuageux',
    3:'Couvert', 45:'Brouillard', 48:'Brouillard givrant',
    51:'Bruine légère', 53:'Bruine', 55:'Bruine forte',
    56:'Bruine légère verglaçante', 57:'Bruine verglaçante forte',
    61:'Pluie légère', 63:'Pluie modérée', 65:'Forte pluie',
    66:'Pluie verglaçante légère', 67:'Pluie verglaçante forte',
    71:'Neige légère', 73:'Neige', 75:'Forte neige', 77:'Grésil',
    80:'Averses légères', 81:'Averses', 82:'Fortes averses',
    85:'Averses de neige légères', 86:'Averses de neige fortes',
    95:'Orage', 96:'Orage avec grêle', 99:'Orage violent'
};

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ── Clés localStorage ─────────────────────────────────────────
const LS_MODE   = 'moadja_meteo_mode';
const LS_COORDS = 'moadja_meteo_coords';

// ── Intervalle refresh auto (30 min) ─────────────────────────
let _meteoRefreshInterval = null;

// ── Utilitaires localStorage ──────────────────────────────────
function _sauverMeteoLS(mode, lat, lon, ville) {
    try {
        localStorage.setItem(LS_MODE, mode);
        localStorage.setItem(LS_COORDS, JSON.stringify({ lat, lon, ville }));
    } catch (e) {}
}

function _lireMeteoLS() {
    try {
        const mode   = localStorage.getItem(LS_MODE);
        const coords = localStorage.getItem(LS_COORDS);
        if (mode && coords) return { mode, ...JSON.parse(coords) };
    } catch (e) {}
    return null;
}

// ── Calcul distance entre deux points (km) — formule Haversine ─
function _distanceKm(lat1, lon1, lat2, lon2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) * Math.sin(dL / 2)
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getNomVille(lat, lon) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`);
        const d = await r.json();
        return d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || 'Ma position';
    } catch { return 'Ma position'; }
}

async function chargerMeteo(lat, lon, nomVille, mode) {
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

        const modeEffectif = mode || 'ville';
        _sauverMeteoLS(modeEffectif, lat, lon, nomVille);

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
    const dateCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

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
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
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

// ── Refresh manuel ────────────────────────────────────────────
window._refreshMeteo = async function () {
    const ls = _lireMeteoLS();
    if (ls?.mode === 'geoloc' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const newLat = pos.coords.latitude;
                const newLon = pos.coords.longitude;
                const ville  = await getNomVille(newLat, newLon);
                await chargerMeteo(newLat, newLon, ville, 'geoloc');
            },
            async () => {
                if (ls?.lat && ls?.lon) {
                    await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'ville');
                }
            }
        );
    } else if (ls?.lat && ls?.lon) {
        await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville');
    }
};

// ── Refresh auto 30 min ───────────────────────────────────────
function _demarrerRefreshAuto() {
    if (_meteoRefreshInterval) clearInterval(_meteoRefreshInterval);
    _meteoRefreshInterval = setInterval(async () => {
        const ls = _lireMeteoLS();
        if (!ls) return;

        if (ls.mode === 'geoloc' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async pos => {
                    const newLat = pos.coords.latitude;
                    const newLon = pos.coords.longitude;
                    const dist = (ls.lat && ls.lon)
                        ? _distanceKm(ls.lat, ls.lon, newLat, newLon)
                        : 999;
                    if (dist > 5) {
                        const ville = await getNomVille(newLat, newLon);
                        await chargerMeteo(newLat, newLon, ville, 'geoloc');
                    } else {
                        await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'geoloc');
                    }
                },
                () => {
                    if (ls.lat && ls.lon) {
                        chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', 'ville');
                    }
                }
            );
        } else if (ls.lat && ls.lon) {
            await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville');
        }
    }, 30 * 60 * 1000);
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

window._selectJourModale = function (idx) {
    _renderModaleMeteo(idx);
};

window._ouvrirModaleMeteo = function () {
    _renderModaleMeteo(0);
};

function afficherDetailJourModale(i) {
    _renderModaleMeteo(i);
}

async function chargerMeteoAuto() {
    const ls = _lireMeteoLS();
    if (ls?.lat && ls?.lon) {
        await chargerMeteo(ls.lat, ls.lon, ls.ville || 'Ma position', ls.mode || 'ville');
        _demarrerRefreshAuto();
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
                await chargerMeteo(
                    d.profil.meteo_lat,
                    d.profil.meteo_lon,
                    d.profil.meteo_ville || 'Ma ville',
                    'ville'
                );
                _demarrerRefreshAuto();
                return;
            }
        }
    } catch {}

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const ville = await getNomVille(pos.coords.latitude, pos.coords.longitude);
                await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville, 'geoloc');
                _demarrerRefreshAuto();
            },
            async () => {
                await chargerMeteo(48.8566, 2.3522, 'Paris', 'ville');
                _demarrerRefreshAuto();
            }
        );
    } else {
        await chargerMeteo(48.8566, 2.3522, 'Paris', 'ville');
        _demarrerRefreshAuto();
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
            await chargerMeteo(res.latitude, res.longitude, res.name, 'ville');
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
            await chargerMeteo(pos.coords.latitude, pos.coords.longitude, ville, 'geoloc');
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
