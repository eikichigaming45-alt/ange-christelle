// ============================================================
// public/js/cycle.js
// Suivi du cycle menstruel — widget, calendrier, journal, mood.
// Auth via JWT Bearer (authHeaders). Pas d'userId client.
// Phases mood calculées dynamiquement selon dureeRegles/dureeCycle.
// _journalCache : { 'YYYY-MM-DD': [ rapport1, rapport2, ... ] }
// Plusieurs rapports sexuels par jour autorisés.
// Mood inline dans le widget, sans modal.
// Sauvegarde manuelle, bouton explicite, pas de timer.
// ============================================================

const Cycle = (() => {

    const PAGE_SIZE = 10;

    const MOOD_ICONS = {
        'Fatiguée'             : '😔',
        'Irritée'              : '😤',
        'Sensibilité haute'    : '🥺',
        'Besoin de repos'      : '🛌',
        'Moins sociable'       : '🚪',
        'Lourdeur corporelle'  : '🪨',
        'Manque de motivation' : '😶',
        'Motivée'              : '💪',
        'Stable'               : '😌',
        'Optimiste'            : '🌤️',
        'Concentrée'           : '🎯',
        'Sociable'             : '🤝',
        'Créative'             : '🎨',
        'Confiance tranquille' : '🌿',
        'Je me sens bien'      : '😊',
        'Confiance max'        : '✨',
        'Énergie haute'        : '⚡',
        'Charme naturel'       : '🌸',
        'Très sociable'        : '🎉',
        'Décisive'             : '🎯',
        'Bonne humeur'         : '😄',
        'Aisance relationnelle': '💬',
        'Apaisée'              : '🕊️',
        'Ralentissement'       : '🐢',
        'Besoin de douceur'    : '🫶',
        'Moins dans le rush'   : '🌙',
        'Patiente'             : '⏳',
        'Introspective'        : '🔮',
        'Irritabilité'         : '😠',
        'Hypersensibilité'     : '💧',
        'Stress facile'        : '😰',
        "Baisse d'énergie"     : '🪫',
        "Besoin d'isolement"   : '🫙',
        'Moins de patience'    : '⏱️',
        'Pensées négatives'    : '🌧️',
        'Sensation de surcharge': '🧳',
    };

    const PHASES_MOOD_DEF = [
        {
            label: '🌑 Règles - Énergie basse',
            items: ['Fatiguée','Irritée','Sensibilité haute','Besoin de repos',
                    'Moins sociable','Lourdeur corporelle','Manque de motivation']
        },
        {
            label: '🌱 Folliculaire - Montée d\'énergie',
            items: ['Bonne humeur','Je me sens bien','Motivée','Stable','Optimiste','Concentrée',
                    'Sociable','Créative','Confiance tranquille']
        },
        {
            label: '☀️ Ovulation - Pic de confiance',
            items: ['Confiance max','Énergie haute','Charme naturel','Très sociable',
                    'Décisive','Bonne humeur','Je me sens bien','Aisance relationnelle']
        },
        {
            label: '🌙 Lutéale début - Calme',
            items: ['Apaisée','Bonne humeur','Je me sens bien','Ralentissement','Besoin de douceur',
                    'Moins dans le rush','Patiente','Introspective']
        },
        {
            label: '🌙 Lutéale fin - SPM',
            items: ['Irritabilité','Hypersensibilité','Bonne humeur','Je me sens bien','Stress facile',"Baisse d'énergie",
                    "Besoin d'isolement",'Moins de patience','Pensées négatives','Sensation de surcharge']
        }
    ];

    // FIX bug #5 : construit minuit heure locale à partir des composantes
    // locales du navigateur — jamais influencé par UTC ou le fuseau serveur.
    // Remplace tous les `new Date()` utilisés comme "date du jour".
    function _aujourdHuiLocal() {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
    }

    function calculerBornesPhases(dureeRegles, dureeCycle) {
        const ovulation    = dureeCycle - 14;
        const debutFertile = dureeCycle - 16;
        return [
            { min: 1,               max: dureeRegles,   def: PHASES_MOOD_DEF[0] },
            { min: dureeRegles + 1, max: debutFertile,  def: PHASES_MOOD_DEF[1] },
            { min: ovulation,       max: ovulation,     def: PHASES_MOOD_DEF[2] },
            { min: ovulation + 1,   max: ovulation + 7, def: PHASES_MOOD_DEF[3] },
            { min: ovulation + 8,   max: dureeCycle,    def: PHASES_MOOD_DEF[4] },
        ];
    }

    function getPhaseMood(jourCycle, calc) {
        if (!jourCycle || !calc) return null;
        const j      = Math.min(jourCycle, calc.dureeCycle);
        const phases = calculerBornesPhases(calc.dureeRegles, calc.dureeCycle);
        const phase  = phases.find(p => j >= p.min && j <= p.max);
        return phase ? phase.def : PHASES_MOOD_DEF[4];
    }

    function authHeaders() {
        const user = JSON.parse(localStorage.getItem('myvibe_user'));
        return {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${user?.token || ''}`
        };
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDate(date) {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    function formatDateInput(date) {
        const d   = new Date(date);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    }

    function parseDateLocale(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function memeJour(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth()    === b.getMonth()    &&
               a.getDate()     === b.getDate();
    }

    function confirmerSuppression(onOui, onNon) {
        document.getElementById('modal-title').textContent = 'Confirmation';
        document.getElementById('modal-body').innerHTML = `
            <p style="color:#333;font-size:15px;margin-bottom:20px">Confirmer la suppression ?</p>
            <div class="modal-actions">
                <button class="btn-delete" id="btn-confirmer-oui">Confirmer</button>
                <button class="btn-cancel" id="btn-confirmer-non">Annuler</button>
            </div>`;
        document.getElementById('overlay').classList.add('on');
        document.getElementById('btn-confirmer-oui').onclick = () => onOui();
        document.getElementById('btn-confirmer-non').onclick = () => onNon();
    }

    function calculerDureeMoyenne(cycles) {
        if (cycles.length < 2) return null;
        const durees = [];
        for (let i = 0; i < cycles.length - 1; i++) {
            const a    = parseDateLocale(cycles[i].date_debut.split('T')[0]);
            const b    = parseDateLocale(cycles[i + 1].date_debut.split('T')[0]);
            const diff = Math.round((a - b) / (1000 * 60 * 60 * 24));
            if (diff > 0 && diff < 60) durees.push(diff);
        }
        if (durees.length === 0) return null;
        return Math.round(durees.reduce((a, b) => a + b, 0) / durees.length);
    }

    function calculerToutesPeriodes(cycles, dureeMoyenne) {
        const periodes      = [];
        const dureeCycleRef = dureeMoyenne || (cycles[0]?.duree_cycle) || 28;

        cycles.forEach(c => {
            const debut       = parseDateLocale(c.date_debut.split('T')[0]);
            const dureeRegles = c.duree_regles || 5;
            const dureeCycle  = dureeMoyenne || c.duree_cycle || 28;
            periodes.push({
                debutRegles  : debut,
                finRegles    : addDays(debut, dureeRegles - 1),
                debutFertile : addDays(debut, dureeCycle - 16),
                finFertile   : addDays(debut, dureeCycle - 12),
                ovulation    : addDays(debut, dureeCycle - 14),
                prochainDebut: addDays(debut, dureeCycle),
                dureeRegles
            });
        });

        if (cycles.length > 0) {
            const dernierDebut   = parseDateLocale(cycles[0].date_debut.split('T')[0]);
            const dureeReglesRef = cycles[0].duree_regles || 5;
            for (let i = 1; i <= 3; i++) {
                const debut = addDays(dernierDebut, dureeCycleRef * i);
                periodes.push({
                    debutRegles  : debut,
                    finRegles    : addDays(debut, dureeReglesRef - 1),
                    debutFertile : addDays(debut, dureeCycleRef - 16),
                    finFertile   : addDays(debut, dureeCycleRef - 12),
                    ovulation    : addDays(debut, dureeCycleRef - 14),
                    prochainDebut: addDays(debut, dureeCycleRef),
                    dureeRegles  : dureeReglesRef
                });
            }
        }

        return periodes;
    }

    let _calcCourant  = null;
    let _moisAffiche  = null;
    let _journalCache = {};
    let _toutesLesP   = [];
    let _moodsActifsCache = [];

    function calculerCycle(dernierCycle, dureeMoyenne) {
        if (!dernierCycle) return null;
        const debut            = parseDateLocale(dernierCycle.date_debut.split('T')[0]);
        const dureeRegles      = dernierCycle.duree_regles || 5;
        const dureeCycle       = dureeMoyenne || dernierCycle.duree_cycle || 28;
        const finRegles        = addDays(debut, dureeRegles - 1);
        const prochainDebut    = addDays(debut, dureeCycle);
        const debutFertile     = addDays(debut, dureeCycle - 16);
        const finFertile       = addDays(debut, dureeCycle - 12);
        const ovulation        = addDays(debut, dureeCycle - 14);
        // FIX : _aujourdHuiLocal() — minuit heure locale, pas UTC
        const aujourd_hui      = _aujourdHuiLocal();
        const joursAvantRegles = Math.round((prochainDebut - aujourd_hui) / (1000 * 60 * 60 * 24));
        const enRegles         = aujourd_hui >= debut && aujourd_hui <= finRegles;
        const enFenetre        = aujourd_hui >= debutFertile && aujourd_hui <= finFertile;
        return {
            debut, finRegles, prochainDebut,
            debutFertile, finFertile, ovulation,
            joursAvantRegles, enRegles, enFenetre,
            dureeRegles, dureeCycle
        };
    }

    function getPhase(calc) {
        if (!calc) return { label: 'Aucun cycle enregistré', emoji: '❓', color: '#888' };
        // FIX : _aujourdHuiLocal()
        const aujourd_hui = _aujourdHuiLocal();
        if (calc.enRegles)  return { label: 'Règles en cours', emoji: '🔴', color: '#e74c3c' };
        if (calc.enFenetre) return { label: 'Fenêtre fertile',  emoji: '🟢', color: '#2ecc71' };
        if (memeJour(aujourd_hui, calc.ovulation)) return { label: "Jour d'ovulation", emoji: '🌟', color: '#f39c12' };
        const jourCycle    = Math.round((aujourd_hui - calc.debut) / (1000 * 60 * 60 * 24)) + 1;
        const debutLuteale = calc.dureeCycle - 14;
        const debutSPM     = calc.dureeCycle - 7;
        if (jourCycle >= debutSPM)     return { label: 'Lutéale fin — SPM', emoji: '🌙', color: '#8b5cf6' };
        if (jourCycle >= debutLuteale) return { label: 'Phase lutéale',      emoji: '🌙', color: '#a78bfa' };
        if (jourCycle > calc.dureeRegles) return { label: 'Phase folliculaire', emoji: '🌱', color: '#10b981' };
        return { label: 'Phase de repos', emoji: '🔵', color: '#3498db' };
    }

    function getPhaseDuJour(dateStr) {
        const date = parseDateLocale(dateStr);
        for (const p of _toutesLesP) {
            if (date >= p.debutRegles && date <= p.finRegles)
                return { label: 'Règles', emoji: '🔴', color: '#e74c3c' };
            if (memeJour(date, p.ovulation))
                return { label: "Jour d'ovulation", emoji: '🌟', color: '#f39c12' };
            if (date >= p.debutFertile && date <= p.finFertile)
                return { label: 'Fenêtre fertile', emoji: '🟢', color: '#2ecc71' };
        }
        return null;
    }

    function calculerJourCycle(calc) {
        if (!calc) return null;
        // FIX : _aujourdHuiLocal()
        const aujourd_hui = _aujourdHuiLocal();
        return Math.round((aujourd_hui - calc.debut) / (1000 * 60 * 60 * 24)) + 1;
    }

    async function chargerJournal(mois, annee) {
        try {
            const res = await fetch(`/api/cycle/journal?mois=${mois}&annee=${annee}`, { headers: authHeaders() });
            const d   = await res.json();
            _journalCache = {};
            (d.journal || []).forEach(r => {
                const key = r.date.split('T')[0];
                if (!_journalCache[key]) _journalCache[key] = [];
                _journalCache[key].push(r);
            });
        } catch { _journalCache = {}; }
    }

    function renderCalendrier(calc) {
        // FIX : _aujourdHuiLocal()
        const aujourd_hui = _aujourdHuiLocal();
        const moisRef     = new Date(_moisAffiche.getFullYear(), _moisAffiche.getMonth(), 1);
        const moisNom     = moisRef.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const nbJours     = new Date(moisRef.getFullYear(), moisRef.getMonth() + 1, 0).getDate();
        let premierJour   = moisRef.getDay();
        premierJour = premierJour === 0 ? 6 : premierJour - 1;

        const jours = ['L','M','M','J','V','S','D'];
        let cases   = '';

        for (let i = 0; i < premierJour; i++) {
            cases += `<div class="cal-day cal-empty"></div>`;
        }

        for (let j = 1; j <= nbJours; j++) {
            const date = new Date(moisRef.getFullYear(), moisRef.getMonth(), j);
            date.setHours(0, 0, 0, 0);
            const dateStr = formatDateInput(date);

            let estRegles  = false;
            let estFertile = false;
            let estOvul    = false;

            for (const p of _toutesLesP) {
                if (date >= p.debutRegles  && date <= p.finRegles)  estRegles  = true;
                if (date >= p.debutFertile && date <= p.finFertile) estFertile = true;
                if (memeJour(date, p.ovulation)) estOvul = true;
            }

            const estAujourdhui = memeJour(date, aujourd_hui);
            const rapports      = _journalCache[dateStr] || [];
            const aRapport      = rapports.length > 0;
            const aSymptomes    = rapports.some(r => r.symptomes);
            const nbRapports    = rapports.length;

            let cls   = 'cal-day';
            let badge = '';
            let icons = '';

            if (estRegles)       cls  += ' cal-regles';
            else if (estFertile) cls  += ' cal-fertile';
            if (estAujourdhui)   cls  += ' cal-today';
            if (estOvul)         badge = '<span class="cal-ovulation-star">★</span>';
            if (aRapport) {
                const couleur = rapports.some(r => r.humeur === 'non_protege') ? 'non-protege' : 'protege';
                icons += `<span class="cal-icon-rapport ${couleur}">♥${nbRapports > 1 ? `<sup>${nbRapports}</sup>` : ''}</span>`;
            }
            if (aSymptomes) icons += `<span class="cal-icon-symptome">●</span>`;

            cases += `<div class="${cls}" onclick="Cycle.ouvrirJournal('${dateStr}')">${j}${badge}${icons ? `<div class="cal-day-icons">${icons}</div>` : ''}</div>`;
        }

        return `
            <div class="cal-wrap">
                <div class="cal-nav">
                    <button class="cal-nav-btn" onclick="Cycle.naviguerCalendrier(-1)">&#8249;</button>
                    <div class="cal-titre">${moisNom.charAt(0).toUpperCase() + moisNom.slice(1)}</div>
                    <button class="cal-nav-btn" onclick="Cycle.naviguerCalendrier(1)">&#8250;</button>
                </div>
                <div class="cal-grid">
                    ${jours.map(j => `<div class="cal-head">${j}</div>`).join('')}
                    ${cases}
                </div>
                <div class="cal-legende">
                    <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fca5a5"></span> Règles</span>
                    <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fde68a"></span> Fertile</span>
                    <span class="cal-leg-item"><span style="color:#f59e0b;font-size:14px">★</span> Ovulation</span>
                    <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#4f46e5"></span> Aujourd'hui</span>
                    <span class="cal-leg-item"><span style="color:#e83e8c">♥</span> Rapport</span>
                    <span class="cal-leg-item"><span style="color:#7c3aed">●</span> Symptômes</span>
                </div>
            </div>`;
    }

    async function naviguerCalendrier(offset) {
        if (!_moisAffiche) return;
        _moisAffiche = new Date(_moisAffiche.getFullYear(), _moisAffiche.getMonth() + offset, 1);
        await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
        const container = document.getElementById('cal-container');
        if (container) container.innerHTML = renderCalendrier(_calcCourant);
    }

    const LABELS_SYMPTOMES = {
        je_me_sens_bien    : 'Je me sens bien',
        crampes_abdominales: 'Crampes abdominales',
        seins_douloureux   : 'Seins douloureux',
        douleurs_lombaires : 'Douleurs lombaires',
        pertes_claires     : 'Pertes claires',
        fievre             : 'Fièvre',
        fatigue            : 'Fatigue',
        humeur_irritable   : 'Humeur irritable'
    };

    const SYMPTOMES_LIST = [
        { key: 'je_me_sens_bien',     label: 'Je me sens bien',     icon: '😊' },
        { key: 'crampes_abdominales', label: 'Crampes abdominales', icon: '🤰' },
        { key: 'seins_douloureux',    label: 'Seins douloureux',    icon: '👙' },
        { key: 'douleurs_lombaires',  label: 'Douleurs lombaires',  icon: '🔙' },
        { key: 'pertes_claires',      label: 'Pertes claires',      icon: '💧' },
        { key: 'fievre',              label: 'Fièvre',              icon: '🌡️' },
        { key: 'fatigue',             label: 'Fatigue',             icon: '😴' },
        { key: 'humeur_irritable',    label: 'Humeur irritable',    icon: '😤' },
    ];

    async function ouvrirJournal(dateStr) {
        const [ry, rm] = dateStr.split('-').map(Number);
        await chargerJournal(rm, ry);
        if (_moisAffiche) _moisAffiche = new Date(ry, rm - 1, 1);

        const rapports = _journalCache[dateStr] || [];
        const dateAff  = new Date(ry, rm - 1, parseInt(dateStr.split('-')[2]))
            .toLocaleDateString('fr-FR', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            });

        const phaseDuJour = getPhaseDuJour(dateStr);
        let contenu = '';

        if (phaseDuJour) {
            contenu += `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;
                            background:${phaseDuJour.color}18;border-left:4px solid ${phaseDuJour.color};
                            border-radius:8px;padding:10px 12px">
                    <span style="font-size:20px">${phaseDuJour.emoji}</span>
                    <span style="font-size:13px;font-weight:700;color:${phaseDuJour.color}">${phaseDuJour.label}</span>
                </div>`;
        }

        if (rapports.length === 0 && !phaseDuJour) {
            contenu += `<p style="color:#9ca3af;font-size:13px;margin-bottom:4px">Aucun enregistrement pour ce jour.</p>`;
        }

        rapports.forEach((r, idx) => {
            const heure = r.created_at
                ? new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : null;
            const symptomes    = r.symptomes ? r.symptomes.split(',').filter(Boolean) : [];
            const rapportLabel = r.humeur === 'protege'
                ? '🛡️ Protégé'
                : r.humeur === 'non_protege'
                    ? '♥ Non protégé'
                    : null;

            contenu += `
                <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-size:11px;color:#9ca3af">
                            Rapport${rapports.length > 1 ? ` #${idx + 1}` : ''}${heure ? ` · ${heure}` : ''}
                        </span>
                        <div style="display:flex;gap:6px">
                            <button class="btn-edit-small"
                                onclick="Cycle._ouvrirFormulaireJournal('${dateStr}', ${r.id})">✏️</button>
                            <button class="btn-edit-small" style="color:#ef4444"
                                onclick="Cycle._supprimerJournal(${r.id}, '${dateStr}')">🗑️</button>
                        </div>
                    </div>
                    ${rapportLabel ? `
                        <span style="background:#fce7f3;color:#db2777;border-radius:20px;
                                     padding:4px 10px;font-size:12px;font-weight:600;
                                     display:inline-block;margin-bottom:6px">
                            ${rapportLabel}
                        </span>` : ''}
                    ${symptomes.length > 0 ? `
                        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
                            ${symptomes.map(s =>
                                `<span style="background:#ede9fe;color:#7c3aed;border-radius:20px;
                                              padding:3px 8px;font-size:11px;font-weight:600">
                                    ${LABELS_SYMPTOMES[s] || s}
                                </span>`
                            ).join('')}
                        </div>` : ''}
                    ${r.notes ? `<div style="font-size:12px;color:#6b7280;line-height:1.4">${r.notes}</div>` : ''}
                </div>`;
        });

        document.getElementById('modal-title').textContent = dateAff;
        document.getElementById('modal-body').innerHTML = `
            <div class="journal-form">                ${contenu}
                <div class="modal-actions" style="margin-top:16px">
                    <button class="btn-save"
                        onclick="Cycle._ouvrirFormulaireJournal('${dateStr}', null)">
                        + Enregistrer un rapport
                    </button>
                    <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Retour</button>
                </div>
            </div>`;
        document.getElementById('overlay').classList.add('on');
    }

    async function _ouvrirFormulaireJournal(dateStr, rapportId) {
        const rapports        = _journalCache[dateStr] || [];
        const journal         = rapportId ? rapports.find(r => r.id === rapportId) || {} : {};
        const isEdit          = !!rapportId;
        const [y, m, d]       = dateStr.split('-').map(Number);
        const dateAff         = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
        const symptomesActifs = journal.symptomes ? journal.symptomes.split(',').filter(Boolean) : [];

        document.getElementById('modal-title').textContent = isEdit
            ? 'Modifier le rapport'
            : 'Enregistrer un rapport';
        document.getElementById('modal-body').innerHTML = `
            <div class="journal-form">
                <div style="font-size:12px;color:#9ca3af;margin-bottom:12px">${dateAff}</div>
                <div class="journal-section-title">Rapport sexuel</div>
                <div class="journal-rapport-btns">
                    <button class="btn-rapport ${journal.humeur === 'protege' ? 'active' : ''}"
                        onclick="Cycle._toggleRapport(this)">🛡️ Protégé</button>
                    <button class="btn-rapport ${journal.humeur === 'non_protege' ? 'active' : ''}"
                        onclick="Cycle._toggleRapport(this)">♥ Non protégé</button>
                </div>
                <div class="journal-section-title" style="margin-top:14px">Symptômes</div>
                <div class="journal-symptomes">
                    ${SYMPTOMES_LIST.map(s => `
                        <label class="symptome-chip ${symptomesActifs.includes(s.key) ? 'active' : ''}"
                            onclick="var cb=this.querySelector('input');cb.checked=!cb.checked;this.classList.toggle('active',cb.checked)">
                            <input type="checkbox" value="${s.key}" ${symptomesActifs.includes(s.key) ? 'checked' : ''}>
                            <span class="symptome-chip-icon">${s.icon}</span>
                            <span class="symptome-chip-label">${s.label}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="journal-section-title" style="margin-top:14px">Notes libres</div>
                <textarea id="journal-notes" rows="3"
                    placeholder="Autre chose à noter...">${journal.notes || ''}</textarea>
                <div class="modal-actions" style="margin-top:16px">
                    <button class="btn-save"
                        onclick="Cycle._sauvegarderJournal('${dateStr}', ${rapportId || 'null'})">
                        💾 Sauvegarder
                    </button>
                    <button class="btn-cancel" onclick="Cycle.ouvrirJournal('${dateStr}')">Annuler</button>
                </div>
            </div>`;
        document.getElementById('overlay').classList.add('on');
    }

    function _toggleRapport(btn) {
        const estDejaActif = btn.classList.contains('active');
        document.querySelectorAll('.btn-rapport').forEach(b => b.classList.remove('active'));
        if (!estDejaActif) btn.classList.add('active');
    }

    async function _sauvegarderJournal(dateStr, rapportId) {
        const rapportBtn = document.querySelector('.btn-rapport.active');
        const rapport    = rapportBtn
            ? (rapportBtn.textContent.includes('Protégé') ? 'protege' : 'non_protege')
            : null;
        const symptomes = [...document.querySelectorAll('.journal-symptomes input:checked')]
            .map(i => i.value).join(',');
        const notes     = document.getElementById('journal-notes').value;
        const [ry, rm]  = dateStr.split('-').map(Number);
        try {
            if (rapportId) {
                await fetch(`/api/cycle/journal/${rapportId}`, {
                    method : 'PUT',
                    headers: authHeaders(),
                    body   : JSON.stringify({ rapport, symptomes, notes })
                });
            } else {
                await fetch('/api/cycle/journal', {
                    method : 'POST',
                    headers: authHeaders(),
                    body   : JSON.stringify({ date: dateStr, rapport, symptomes, notes })
                });
            }
            await chargerJournal(rm, ry);
            if (_moisAffiche) _moisAffiche = new Date(ry, rm - 1, 1);
            ouvrirJournal(dateStr);
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la sauvegarde.</p>
                <div class="modal-actions">
                    <button class="btn-cancel"
                        onclick="Cycle._ouvrirFormulaireJournal('${dateStr}', ${rapportId || 'null'})">
                        Retour
                    </button>
                </div>`;
        }
    }

    async function _supprimerJournal(id, dateStr) {
        confirmerSuppression(
            async () => {
                const [ry, rm] = dateStr.split('-').map(Number);
                try {
                    await fetch(`/api/cycle/journal/${id}`, { method: 'DELETE', headers: authHeaders() });
                    await chargerJournal(rm, ry);
                    if (_moisAffiche) _moisAffiche = new Date(ry, rm - 1, 1);
                    ouvrirJournal(dateStr);
                } catch {
                    document.getElementById('modal-title').textContent = 'Erreur';
                    document.getElementById('modal-body').innerHTML = `
                        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la suppression.</p>
                        <div class="modal-actions">
                            <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Retour</button>
                        </div>`;
                }
            },
            () => ouvrirJournal(dateStr)
        );
    }

    // ── Vue widget mood : invite si vide, chips si rempli ─────
    async function _afficherMoodInline(calc) {
        const zone = document.getElementById('cycle-mood-zone');
        if (!zone || !calc) return;

        // FIX : formatDateInput(_aujourdHuiLocal()) — date locale garantie
        const today     = formatDateInput(_aujourdHuiLocal());
        const jourCycle = calculerJourCycle(calc);
        const phaseMood = getPhaseMood(jourCycle, calc);

        _moodsActifsCache = [];
        try {
            const res = await fetch(`/api/cycle/mood?date=${today}`, { headers: authHeaders() });
            const d   = await res.json();
            if (d.mood?.moods) {
                _moodsActifsCache = d.mood.moods.split(',').filter(s => s.trim() !== '');
            }
        } catch { /* silencieux */ }

        _renderMoodZone(zone, phaseMood, _moodsActifsCache, today);
    }

    function _renderMoodZone(zone, phaseMood, moodsActifs, today) {
        const aDejaHumeur = moodsActifs.length > 0;

        if (aDejaHumeur) {
            const chipsRemplies = moodsActifs.map(item => {
                const icone = MOOD_ICONS[item] || '💭';
                return `<button
                    class="mood-chip-filled"
                    onclick="Cycle._ouvrirEditionMood('${today}')"
                    title="Modifier mon humeur"
                    style="display:inline-flex;align-items:center;gap:6px;
                           border:1.5px solid #7c3aed;background:#ede9fe;
                           color:#7c3aed;border-radius:20px;padding:5px 12px;
                           font-size:12px;font-weight:600;cursor:pointer;transition:all .15s">
                    <span style="font-size:15px;line-height:1">${icone}</span>
                    <span>${item}</span>
                </button>`;
            }).join('');

            zone.innerHTML = `
                <div style="border-top:1px solid #f0e6ff;margin-top:12px;padding-top:10px">
                    <div style="display:flex;align-items:center;justify-content:space-between;
                                gap:6px;margin-bottom:8px">
                        <span style="font-size:11px;color:#10b981;font-weight:600">✓ Humeur enregistrée</span>
                        <button onclick="Cycle._ouvrirEditionMood('${today}')"
                            style="background:none;border:none;cursor:pointer;
                                   font-size:11px;color:#9ca3af;text-decoration:underline;padding:0">
                            Modifier
                        </button>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">${chipsRemplies}</div>
                </div>`;
        } else {
            zone.innerHTML = `
                <div style="border-top:1px solid #f0e6ff;margin-top:12px;padding-top:10px">
                    <button onclick="Cycle._ouvrirEditionMood('${today}')"
                        style="width:100%;display:flex;align-items:center;justify-content:space-between;
                               background:#faf5ff;border:1.5px dashed #c4b5fd;border-radius:10px;
                               padding:10px 14px;cursor:pointer;transition:background .2s">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="font-size:18px">💭</span>
                            <span style="font-size:13px;color:#7c3aed;font-weight:600">
                                Comment tu te sens aujourd'hui ?
                            </span>
                        </div>
                        ${phaseMood ? `
                            <span style="font-size:10px;background:#f5f3ff;color:#7c3aed;
                                border-radius:10px;padding:2px 7px;font-weight:600;
                                white-space:nowrap;flex-shrink:0">
                                ${phaseMood.label}
                            </span>` : ''}
                    </button>
                </div>`;
        }
    }

    // ── Panneau d'édition mood — lit _moodsActifsCache, pas le DOM ──
    function _ouvrirEditionMood(today) {
        const zone = document.getElementById('cycle-mood-zone');
        if (!zone) return;

        const moodsActuels = _moodsActifsCache;

        const jourCycle  = _calcCourant ? calculerJourCycle(_calcCourant) : null;
        const phaseMood  = _calcCourant ? getPhaseMood(jourCycle, _calcCourant) : null;
        const itemsPhase = phaseMood?.items || [];

        const chipsPhase = itemsPhase.map(item => {
            const icone = MOOD_ICONS[item] || '💭';
            const sel   = moodsActuels.includes(item);
            return _chipEditHtml(item, icone, sel);
        }).join('');

        zone.innerHTML = `
            <div style="border-top:1px solid #f0e6ff;margin-top:12px;padding-top:10px">
                ${phaseMood ? `
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                    <span style="font-size:11px;color:#9ca3af">Humeurs liées à ta phase actuelle</span>
                    <span style="font-size:10px;background:#f5f3ff;color:#7c3aed;
                        border-radius:10px;padding:2px 7px;font-weight:600;white-space:nowrap">
                        ${phaseMood.label}
                    </span>
                </div>
                <div id="cycle-mood-chips-phase" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
                    ${chipsPhase}
                </div>` : ''}
                <button onclick="Cycle._sauvegarderMoodManuel('${today}')"
                    style="width:100%;padding:9px;background:#7c3aed;color:#fff;border:none;
                           border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;
                           transition:background .2s">
                    💾 Sauvegarder mon humeur
                </button>
            </div>`;
    }

    function _chipEditHtml(item, icone, sel) {
        return `<button
            data-mood="${item}"
            data-selected="${sel ? '1' : '0'}"
            onclick="Cycle._toggleMoodChip(this)"
            style="display:inline-flex;align-items:center;gap:6px;
                   border:1.5px solid ${sel ? '#7c3aed' : '#e5e7eb'};
                   background:${sel ? '#ede9fe' : '#f9fafb'};
                   color:${sel ? '#7c3aed' : '#6b7280'};
                   border-radius:20px;padding:5px 12px;font-size:12px;
                   font-weight:${sel ? '600' : '400'};cursor:pointer;transition:all .15s">
            <span style="font-size:15px;line-height:1">${icone}</span>
            <span>${item}</span>
        </button>`;
    }

    function _toggleMoodChip(btn) {
        const estActif = btn.dataset.selected === '1';
        btn.dataset.selected = estActif ? '0' : '1';
        const sel = btn.dataset.selected === '1';
        btn.style.border     = `1.5px solid ${sel ? '#7c3aed' : '#e5e7eb'}`;
        btn.style.background = sel ? '#ede9fe' : '#f9fafb';
        btn.style.color      = sel ? '#7c3aed' : '#6b7280';
        btn.style.fontWeight = sel ? '600' : '400';
    }

    async function _sauvegarderMoodManuel(today) {
        const chips  = [...document.querySelectorAll('#cycle-mood-chips-phase button')];
        const actifs = chips
            .filter(b => b.dataset.selected === '1')
            .map(b => b.dataset.mood);

        const btn = document.querySelector(
            '#cycle-mood-zone button[onclick*="_sauvegarderMoodManuel"]'
        );
        if (btn) { btn.textContent = '...'; btn.disabled = true; }

        try {
            await fetch('/api/cycle/mood', {
                method : 'POST',
                headers: authHeaders(),
                body   : JSON.stringify({ date: today, moods: actifs.join(',') })
            });
        } catch { /* silencieux */ }

        if (_calcCourant) await _afficherMoodInline(_calcCourant);
    }

    async function ouvrirModalMood(calc) {
        await _afficherMoodInline(calc);
    }

    async function _sauvegarderMood(date) {
        const moods = [...document.querySelectorAll('.journal-symptomes input:checked')]
            .map(i => i.value).join(',');
        try {
            await fetch('/api/cycle/mood', {
                method : 'POST',
                headers: authHeaders(),
                body   : JSON.stringify({ date, moods })
            });
            charger();
            closeModal();
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la sauvegarde.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>`;
        }
    }

    function renderBlocMood() {
        return `<div id="cycle-mood-zone"></div>`;
    }

    function renderWidget(cycles, dureeMoyenne) {
        const dernierCycle = cycles.length > 0 ? cycles[0] : null;
        const calc         = calculerCycle(dernierCycle, dureeMoyenne);
        const phase        = getPhase(calc);

        let labelOvulation, valeurOvulation, labelFenetre, valeurFenetre;
        if (calc) {
            // FIX : _aujourdHuiLocal()
            const aujourd_hui = _aujourdHuiLocal();
            if (calc.ovulation < aujourd_hui) {
                const prochaineOvulation    = addDays(calc.ovulation, calc.dureeCycle);
                const prochaineFenetreDebut = addDays(prochaineOvulation, -5);
                const prochaineFenetreFin   = addDays(prochaineOvulation, 1);
                labelOvulation  = 'Prochaine ovulation';
                valeurOvulation = formatDate(prochaineOvulation);
                labelFenetre    = 'Prochaine fenêtre fertile';
                valeurFenetre   = `${formatDate(prochaineFenetreDebut)} → ${formatDate(prochaineFenetreFin)}`;
            } else {
                labelOvulation  = 'Ovulation estimée';
                valeurOvulation = formatDate(calc.ovulation);
                labelFenetre    = 'Fenêtre fertile';
                valeurFenetre   = `${formatDate(calc.debutFertile)} → ${formatDate(calc.finFertile)}`;
            }
        }

        return `
            <div class="widget-cycle">
                <div class="cycle-phase" style="border-left:4px solid ${phase.color}">
                    <span class="cycle-phase-emoji">${phase.emoji}</span>
                    <div>
                        <div class="cycle-phase-label">${phase.label}</div>
                        ${calc ? `<div class="cycle-phase-sub">
                            ${calc.enRegles
                                ? `Fin estimée le ${formatDate(calc.finRegles)}`
                                : calc.joursAvantRegles > 0
                                    ? `Prochaines règles dans <strong>${calc.joursAvantRegles} jour${calc.joursAvantRegles > 1 ? 's' : ''}</strong>`
                                    : `Règles attendues aujourd'hui`}
                        </div>` : ''}
                    </div>
                </div>
                ${calc ? `
                <div class="cycle-infos">
                    <div class="cycle-info-item">
                        <span class="cycle-info-icon">📅</span>
                        <div>
                            <div class="cycle-info-label">Dernier début</div>
                            <div class="cycle-info-value">${formatDate(calc.debut)}</div>
                        </div>
                    </div>
                    <div class="cycle-info-item">
                        <span class="cycle-info-icon">🔄</span>
                        <div>
                            <div class="cycle-info-label">Durée cycle ${dureeMoyenne ? '(calculée)' : '(estimée)'}</div>
                            <div class="cycle-info-value">${calc.dureeCycle} jours</div>
                        </div>
                    </div>
                    <div class="cycle-info-item">
                        <span class="cycle-info-icon">🌿</span>
                        <div>
                            <div class="cycle-info-label">${labelFenetre}</div>
                            <div class="cycle-info-value">${valeurFenetre}</div>
                        </div>
                    </div>
                    <div class="cycle-info-item">
                        <span class="cycle-info-icon">✨</span>
                        <div>
                            <div class="cycle-info-label">${labelOvulation}</div>
                            <div class="cycle-info-value">${valeurOvulation}</div>
                        </div>
                    </div>
                </div>
                <div class="cycle-progress-wrap">
                    <div class="cycle-progress-label">Progression du cycle (${calc.dureeCycle} jours)</div>
                    <div class="cycle-progress-bar">
                        <div class="cycle-progress-fill" style="width:${Math.min(100, Math.max(0,
                            Math.round((_aujourdHuiLocal() - calc.debut) / (1000 * 60 * 60 * 24)
                            / calc.dureeCycle * 100)))}%;background:${phase.color}">
                        </div>
                    </div>
                </div>` : ''}
                <div class="cycle-actions">
                    <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">
                        + Enregistrer mes règles
                    </button>
                    ${cycles.length > 0
                        ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">
                               Historique (${cycles.length})
                           </button>`
                        : ''}
                </div>
                ${renderBlocMood()}
            </div>`;
    }

    async function charger() {
        const container = document.getElementById('widget-cycle-content');
        if (!container) return;
        const user = JSON.parse(localStorage.getItem('myvibe_user'));
        if (!user?.token) { setTimeout(() => charger(), 300); return; }
        try {
            const res = await fetch('/api/cycle', { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const d            = await res.json();
            const cycles       = d.cycles || [];
            const dureeMoyenne = calculerDureeMoyenne(cycles);
            const dernierCycle = cycles.length > 0 ? cycles[0] : null;
            const calc         = calculerCycle(dernierCycle, dureeMoyenne);

            _calcCourant = calc;
            container.innerHTML = renderWidget(cycles, dureeMoyenne);

            if (calc) await _afficherMoodInline(calc);
        } catch {
            container.innerHTML = `<p class="cycle-error">Erreur de chargement du cycle.</p>`;
        }
    }

    async function ouvrirModalCalendrier() {
        try {
            const res          = await fetch('/api/cycle', { headers: authHeaders() });
            const d            = await res.json();
            const cycles       = d.cycles || [];
            const dureeMoyenne = calculerDureeMoyenne(cycles);
            const dernierCycle = cycles.length > 0 ? cycles[0] : null;
            const calc         = calculerCycle(dernierCycle, dureeMoyenne);
            const phase        = getPhase(calc);

            _calcCourant = calc;
            // FIX : _aujourdHuiLocal()
            const auj    = _aujourdHuiLocal();
            _moisAffiche = new Date(auj.getFullYear(), auj.getMonth(), 1);
            _toutesLesP  = calculerToutesPeriodes(cycles, dureeMoyenne);

            await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());

            document.getElementById('modal-title').textContent = 'Suivi du cycle';
            document.getElementById('modal-body').innerHTML = `
                <div class="modal-cycle-main">
                    ${calc ? `
                    <div class="cycle-phase" style="border-left:4px solid ${phase.color};margin-bottom:16px">
                        <span class="cycle-phase-emoji">${phase.emoji}</span>
                        <div>
                            <div class="cycle-phase-label">${phase.label}</div>
                            <div class="cycle-phase-sub">
                                ${calc.enRegles
                                    ? `Fin estimée le ${formatDate(calc.finRegles)}`
                                    : calc.joursAvantRegles > 0
                                        ? `Prochaines règles dans <strong>${calc.joursAvantRegles} jour${calc.joursAvantRegles > 1 ? 's' : ''}</strong>`
                                        : `Règles attendues aujourd'hui`}
                            </div>
                        </div>
                    </div>
                    ` : '<p style="color:#9ca3af;margin-bottom:16px">Aucun cycle enregistré.</p>'}
                    ${dureeMoyenne
                        ? `<div class="cycle-duree-info">Durée moyenne calculée : <strong>${dureeMoyenne} jours</strong> (sur ${cycles.length} cycles)</div>`
                        : ''}
                    <div id="cal-container">${renderCalendrier(calc)}</div>
                    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
                        <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">
                            + Enregistrer mes règles
                        </button>
                        ${cycles.length > 0
                            ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">
                                   Historique (${cycles.length})
                               </button>`
                            : ''}
                    </div>
                </div>`;
            document.getElementById('overlay').classList.add('on');
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur de chargement.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>`;
        }
    }

    function ouvrirModalAjout(cycleExistant = null) {
        const isEdit = !!cycleExistant;
        // FIX : _aujourdHuiLocal() pour la date max du champ date
        const today  = formatDateInput(_aujourdHuiLocal());
        document.getElementById('modal-title').textContent = isEdit
            ? 'Modifier le cycle'
            : 'Enregistrer mes règles';
        document.getElementById('modal-body').innerHTML = `
            <div class="modal-cycle-form">
                <label>Date de début des règles *</label>
                <input type="date" id="cycle-date-debut"
                    value="${isEdit
                        ? formatDateInput(parseDateLocale(cycleExistant.date_debut.split('T')[0]))
                        : today}"
                    max="${today}" />
                <label>Durée des règles (jours)</label>
                <input type="number" id="cycle-duree-regles" min="1" max="10"
                    value="${isEdit ? cycleExistant.duree_regles : 5}" />
                <label>Durée du cycle (jours) — sera recalculée automatiquement après 2 cycles</label>
                <input type="number" id="cycle-duree-cycle" min="21" max="45"
                    value="${isEdit ? cycleExistant.duree_cycle : 28}" />
                <label>Notes (optionnel)</label>
                <textarea id="cycle-notes" rows="3"
                    placeholder="Douleurs, humeur, symptômes...">${isEdit ? (cycleExistant.notes || '') : ''}</textarea>
                <div class="modal-actions">
                    <button class="btn-save" onclick="Cycle.sauvegarder(${isEdit ? cycleExistant.id : 'null'})">
                        ${isEdit ? 'Modifier' : 'Enregistrer'}
                    </button>
                    ${isEdit
                        ? `<button class="btn-delete" onclick="Cycle.supprimer(${cycleExistant.id})">Supprimer</button>`
                        : ''}
                    <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Annuler</button>
                </div>
            </div>`;
        document.getElementById('overlay').classList.add('on');
    }

    async function sauvegarder(id = null) {
        const date_debut   = document.getElementById('cycle-date-debut').value;
        const duree_regles = parseInt(document.getElementById('cycle-duree-regles').value);
        const duree_cycle  = parseInt(document.getElementById('cycle-duree-cycle').value);
        const notes        = document.getElementById('cycle-notes').value;
        if (!date_debut) {
            document.getElementById('modal-body').innerHTML += `
                <p style="color:#ef4444;font-size:13px;margin-top:8px">La date de début est obligatoire.</p>`;
            return;
        }
        const method = id ? 'PUT' : 'POST';
        const url    = id ? `/api/cycle/${id}` : '/api/cycle';
        try {
            const res = await fetch(url, {
                method,
                headers: authHeaders(),
                body   : JSON.stringify({ date_debut, duree_regles, duree_cycle, notes })
            });
            if (!res.ok) throw new Error();
            charger();
            ouvrirModalCalendrier();
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la sauvegarde.</p>
                <div class="modal-actions">
                    <button class="btn-cancel"
                        onclick="Cycle.ouvrirModalAjout(${id ? id : 'null'})">Retour</button>
                </div>`;
        }
    }

    async function supprimer(id) {
        confirmerSuppression(
            async () => {
                try {
                    await fetch(`/api/cycle/${id}`, { method: 'DELETE', headers: authHeaders() });
                    charger();
                    ouvrirHistorique();
                } catch {
                    document.getElementById('modal-title').textContent = 'Erreur';
                    document.getElementById('modal-body').innerHTML = `
                        <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la suppression.</p>
                        <div class="modal-actions">
                            <button class="btn-cancel" onclick="Cycle.ouvrirHistorique()">Retour</button>
                        </div>`;
                }
            },
            () => ouvrirHistorique()
        );
    }

    async function ouvrirHistorique(page = 0) {
        try {
            const res          = await fetch('/api/cycle', { headers: authHeaders() });
            const d            = await res.json();
            const cycles       = d.cycles || [];
            const dureeMoyenne = calculerDureeMoyenne(cycles);

            const totalPages  = Math.ceil(cycles.length / PAGE_SIZE);
            const cyclesPaged = cycles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

            const lignes = cyclesPaged.map(c => `
                <div class="cycle-historique-item">
                    <div>
                        <strong>${formatDate(parseDateLocale(c.date_debut.split('T')[0]))}</strong>
                        <span class="cycle-histo-detail">Règles : ${c.duree_regles}j — Cycle : ${c.duree_cycle}j</span>
                        ${c.notes ? `<span class="cycle-histo-notes">${c.notes}</span>` : ''}
                    </div>
                    <button class="btn-edit-small"
                        onclick="Cycle.ouvrirModalAjout(${JSON.stringify(c).replace(/"/g, '&quot;')})">✏️</button>
                </div>
            `).join('');

            const pagination = totalPages > 1 ? `
                <div class="rdv-pagination">
                    ${page > 0
                        ? `<button class="btn-cycle-secondary"
                               onclick="Cycle.ouvrirHistorique(${page - 1})">← Précédent</button>`
                        : ''}
                    <span>${page + 1} / ${totalPages}</span>
                    ${page < totalPages - 1
                        ? `<button class="btn-cycle-secondary"
                               onclick="Cycle.ouvrirHistorique(${page + 1})">Suivant →</button>`
                        : ''}
                </div>` : '';

            document.getElementById('modal-title').textContent = 'Historique des cycles';
            document.getElementById('modal-body').innerHTML = `
                <div class="cycle-historique">
                    ${dureeMoyenne
                        ? `<div class="cycle-duree-info" style="margin-bottom:12px">
                               Durée moyenne calculée : <strong>${dureeMoyenne} jours</strong>
                           </div>`
                        : ''}
                    ${lignes || '<p>Aucun cycle enregistré.</p>'}
                    ${pagination}
                    <div style="display:flex;gap:8px;margin-top:12px">
                        <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">+ Nouveau cycle</button>
                        <button class="btn-cycle-secondary" onclick="Cycle.ouvrirModalCalendrier()">← Retour</button>
                    </div>
                </div>`;
            document.getElementById('overlay').classList.add('on');
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">
                    Erreur de chargement de l'historique.
                </p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Retour</button>
                </div>`;
        }
    }

    function _getCalcCourant() {
        return _calcCourant;
    }

    return {
        charger,
        ouvrirModalAjout,
        ouvrirModalCalendrier,
        naviguerCalendrier,
        sauvegarder,
        supprimer,
        ouvrirHistorique,
        ouvrirJournal,
        _ouvrirFormulaireJournal,
        ouvrirModalMood,
        _toggleRapport,
        _sauvegarderJournal,
        _supprimerJournal,
        _sauvegarderMood,
        _toggleMoodChip,
        _sauvegarderMoodManuel,
        _ouvrirEditionMood,
        _ouvrirMoodDepuisWidget : async function() {},
        _getCalcCourant
    };

})();


