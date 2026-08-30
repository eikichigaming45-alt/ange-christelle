// ============================================================
// public/js/cycle.js
// Suivi du cycle menstruel — widget, calendrier, journal, mood.
// Auth via JWT Bearer (authHeaders). Pas d'userId client.
// Phases mood calculées dynamiquement selon dureeRegles/dureeCycle.
// _journalCache : { 'YYYY-MM-DD': [ rapport1, rapport2, ... ] }
// Plusieurs rapports sexuels par jour autorisés.
// Mood inline dans le widget, sans modal.
// Sauvegarde manuelle, bouton explicite, pas de timer.
// Retard détecté si joursAvantRegles < 0 — gel ovulation/fenêtre.
// Message bienveillant permanent selon jours de retard.
// Durée règles formulaire calculée depuis historique.
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
            items: ['Irritabilité','Hypersensibilité','Bonne humeur','Je me sens bien','Stress facile',
                    "Baisse d'énergie","Besoin d'isolement",'Moins de patience',
                    'Pensées négatives','Sensation de surcharge']
        }
    ];

    function _aujourdHuiLocal() {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
    }

    function calculerDureeReglesMoyenne(cycles) {
        if (!cycles.length) return 3;
        const durees = cycles.map(c => c.duree_regles).filter(d => d > 0);
        if (!durees.length) return 3;
        return Math.round(durees.reduce((a, b) => a + b, 0) / durees.length);
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
        const user = JSON.parse(localStorage.getItem('moadja_user'));
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
        const periodes       = [];
        const dureeCycleRef  = dureeMoyenne || (cycles[0]?.duree_cycle) || 28;
        const dureeReglesRef = calculerDureeReglesMoyenne(cycles);

        cycles.forEach(c => {
            const debut       = parseDateLocale(c.date_debut.split('T')[0]);
            const dureeRegles = c.duree_regles || dureeReglesRef;
            const dureeCycle  = dureeMoyenne || c.duree_cycle || 28;
            periodes.push({
                debutRegles  : debut,
                finRegles    : addDays(debut, dureeRegles - 1),
                debutFertile : addDays(debut, dureeCycle - 16),
                finFertile   : addDays(debut, dureeCycle - 12),
                ovulation    : addDays(debut, dureeCycle - 14),
                prochainDebut: addDays(debut, dureeCycle),
                dureeRegles,
                estSaisie    : true
            });
        });

        if (cycles.length > 0) {
            const dernierDebut = parseDateLocale(cycles[0].date_debut.split('T')[0]);
            for (let i = 1; i <= 3; i++) {
                const debut = addDays(dernierDebut, dureeCycleRef * i);
                periodes.push({
                    debutRegles  : debut,
                    finRegles    : addDays(debut, dureeReglesRef - 1),
                    debutFertile : addDays(debut, dureeCycleRef - 16),
                    finFertile   : addDays(debut, dureeCycleRef - 12),
                    ovulation    : addDays(debut, dureeCycleRef - 14),
                    prochainDebut: addDays(debut, dureeCycleRef),
                    dureeRegles  : dureeReglesRef,
                    estSaisie    : false
                });
            }
        }

        return periodes;
    }

    let _calcCourant      = null;
    let _cyclesCourants   = [];
    let _moisAffiche      = null;
    let _journalCache     = {};
    let _toutesLesP       = [];
    let _moodsActifsCache = [];

    function calculerCycle(dernierCycle, dureeMoyenne) {
        if (!dernierCycle) return null;
        const debut            = parseDateLocale(dernierCycle.date_debut.split('T')[0]);
        const dureeRegles      = dernierCycle.duree_regles || 3;
        const dureeCycle       = dureeMoyenne || dernierCycle.duree_cycle || 28;
        const finRegles        = addDays(debut, dureeRegles - 1);
        const prochainDebut    = addDays(debut, dureeCycle);
        const debutFertile     = addDays(debut, dureeCycle - 16);
        const finFertile       = addDays(debut, dureeCycle - 12);
        const ovulation        = addDays(debut, dureeCycle - 14);
        const aujourd_hui      = _aujourdHuiLocal();
        const joursAvantRegles = Math.round((prochainDebut - aujourd_hui) / (1000 * 60 * 60 * 24));
        const enRegles         = aujourd_hui >= debut && aujourd_hui <= finRegles;
        const enFenetre        = aujourd_hui >= debutFertile && aujourd_hui <= finFertile;
        const enRetard         = joursAvantRegles < 0 && !enRegles;
        const joursRetard      = enRetard ? Math.abs(joursAvantRegles) : 0;
        return {
            debut, finRegles, prochainDebut,
            debutFertile, finFertile, ovulation,
            joursAvantRegles, enRegles, enFenetre,
            enRetard, joursRetard,
            dureeRegles, dureeCycle
        };
    }

    function getPhase(calc) {
        if (!calc) return { label: 'Aucun cycle enregistré', emoji: '❓', color: '#888' };
        const aujourd_hui = _aujourdHuiLocal();
        if (calc.enRetard)  return { label: 'Règles en retard', emoji: '⏳', color: '#f59e0b' };
        if (calc.enRegles)  return { label: 'Règles en cours',  emoji: '🔴', color: '#e74c3c' };
        if (calc.enFenetre) return { label: 'Fenêtre fertile',  emoji: '🟢', color: '#2ecc71' };
        if (memeJour(aujourd_hui, calc.ovulation)) return { label: "Jour d'ovulation", emoji: '🌟', color: '#f39c12' };
        const jourCycle    = Math.round((aujourd_hui - calc.debut) / (1000 * 60 * 60 * 24)) + 1;
        const debutLuteale = calc.dureeCycle - 14;
        const debutSPM     = calc.dureeCycle - 7;
        if (jourCycle >= debutSPM)        return { label: 'Lutéale fin - SPM',  emoji: '🌙', color: '#8b5cf6' };
        if (jourCycle >= debutLuteale)    return { label: 'Phase lutéale',       emoji: '🌙', color: '#a78bfa' };
        if (jourCycle > calc.dureeRegles) return { label: 'Phase folliculaire',  emoji: '🌱', color: '#10b981' };
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

    function _infoBienveillantRetard(joursRetard, calc) {
        if (joursRetard <= 3) {
            return {
                icone  : '🌿',
                message: `Le stress, la fatigue ou un changement de routine peuvent décaler tes règles de quelques jours. C'est tout à fait normal.`
            };
        }

        if (joursRetard <= 7) {
            const aRapportNonProtege = calc
                ? Object.entries(_journalCache).some(([dateStr, rapports]) => {
                    const date = parseDateLocale(dateStr);
                    return date >= calc.debut && rapports.some(r => r.humeur === 'non_protege');
                })
                : false;

            const message = aRapportNonProtege
                ? `Un retard de ${joursRetard} jours peut avoir plusieurs causes. Tu as eu des rapports non protégés - un test de grossesse peut t'apporter une réponse claire.`
                : `Un retard de ${joursRetard} jours peut avoir plusieurs causes. Le stress ou un changement hormonal peuvent en être la raison.`;

            return { icone: '🤍', message };
        }

        return {
            icone  : '🩺',
            message: `Un retard de ${joursRetard} jours mérite attention. Pense à consulter un médecin ou un gynécologue pour en savoir plus.`
        };
    }

    function renderBandeauRetard(calc) {
        const today = formatDateInput(_aujourdHuiLocal());
        const info  = _infoBienveillantRetard(calc.joursRetard, calc);
        return `
            <div class="cycle-bandeau-retard">
                <div class="cycle-bandeau-retard-titre">
                    <span style="font-size:20px">⏳</span>
                    Règles non arrivées - ${calc.joursRetard} jour${calc.joursRetard > 1 ? 's' : ''} de retard
                </div>
                <div class="cycle-bandeau-retard-sub">
                    Attendues le ${formatDate(calc.prochainDebut)}.
                    Si elles démarrent aujourd'hui, enregistre-les ci-dessous.
                </div>
                <div class="cycle-bandeau-retard-actions">
                    <button class="btn-retard-primaire"
                        onclick="Cycle.ouvrirModalAjout(null, true)">
                        🩸 Mes règles ont démarré
                    </button>
                    <button class="btn-retard-secondaire"
                        onclick="Cycle._signalerRetard('${today}', ${calc.joursRetard})">
                        📋 Signaler un retard
                    </button>
                </div>
                <div style="margin-top:10px;background:#fffbeb;border-radius:10px;
                            padding:12px 14px;border-left:3px solid #f59e0b">
                    <div style="display:flex;align-items:flex-start;gap:8px">
                        <span style="font-size:18px;flex-shrink:0">${info.icone}</span>
                        <span style="font-size:12px;color:#92400e;line-height:1.5">${info.message}</span>
                    </div>
                </div>
                <div id="cycle-retard-message"></div>
            </div>`;
    }

    async function _signalerRetard(dateStr, joursRetard) {
        try {
            await fetch('/api/cycle/journal', {
                method : 'POST',
                headers: authHeaders(),
                body   : JSON.stringify({
                    date     : dateStr,
                    rapport  : null,
                    symptomes: null,
                    notes    : `Retard signalé - ${joursRetard} jour${joursRetard > 1 ? 's' : ''}`
                })
            });
            const [ry, rm] = dateStr.split('-').map(Number);
            await chargerJournal(rm, ry);
        } catch { /* silencieux */ }

        const zone = document.getElementById('cycle-retard-message');
        if (zone) {
            zone.innerHTML = `
                <div style="font-size:11px;color:#10b981;font-weight:600;margin-top:8px;
                            display:flex;align-items:center;gap:4px">
                    ✓ Retard enregistré dans ton journal
                </div>`;
        }
    }

    function renderCalendrier(calc) {
        // Guard : _moisAffiche peut être null si init() n'a pas encore tourné
        if (!_moisAffiche) {
            const n = _aujourdHuiLocal();
            _moisAffiche = new Date(n.getFullYear(), n.getMonth(), 1);
            _moisAffiche.setHours(0, 0, 0, 0);
        }

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

        const periodeProchaine = _toutesLesP.find(p => !p.estSaisie);

        for (let j = 1; j <= nbJours; j++) {
            const date = new Date(moisRef.getFullYear(), moisRef.getMonth(), j);
            date.setHours(0, 0, 0, 0);
            const dateStr = formatDateInput(date);

            let estReglesSaisies = false;
            let estReglesPrevu   = false;
            let estRetard        = false;
            let estFertile       = false;
            let estOvul          = false;

            for (const p of _toutesLesP) {
                if (date >= p.debutRegles && date <= p.finRegles) {
                    if (p.estSaisie) estReglesSaisies = true;
                    else             estReglesPrevu   = true;
                }
                if (date >= p.debutFertile && date <= p.finFertile) estFertile = true;
                if (memeJour(date, p.ovulation)) estOvul = true;
            }

            if (calc?.enRetard && periodeProchaine &&
                date >= periodeProchaine.debutRegles &&
                date <= periodeProchaine.finRegles &&
                date <= aujourd_hui &&
                !estReglesSaisies) {
                estRetard      = true;
                estReglesPrevu = false;
            }

            const estAujourdhui = memeJour(date, aujourd_hui);
            const rapports      = _journalCache[dateStr] || [];
            const aRapport      = rapports.length > 0;
            const aSymptomes    = rapports.some(r => r.symptomes);
            const nbRapports    = rapports.length;

            let cls   = 'cal-day';
            let badge = '';
            let icons = '';

            if (estReglesSaisies)    cls += ' cal-regles';
            else if (estRetard)      cls += ' cal-retard';
            else if (estReglesPrevu) cls += ' cal-regles-prevu';
            else if (estFertile)     cls += ' cal-fertile';

            if (estAujourdhui) cls += ' cal-today';
            if (estOvul && !calc?.enRetard) badge = '<span class="cal-ovulation-star">★</span>';

            if (aRapport) {
                const couleur = rapports.some(r => r.humeur === 'non_protege') ? 'non-protege' : 'protege';
                icons += `<span class="cal-icon-rapport ${couleur}">♥${nbRapports > 1 ? `<sup>${nbRapports}</sup>` : ''}</span>`;
            }
            if (aSymptomes) icons += `<span class="cal-icon-symptome">●</span>`;

            cases += `<div class="${cls}" onclick="Cycle.ouvrirJournal('${dateStr}')">${j}${badge}${icons ? `<div class="cal-day-icons">${icons}</div>` : ''}</div>`;
        }

        const legendeRetard = calc?.enRetard
            ? `<span class="cal-leg-item"><span class="cal-leg-dot-retard"></span> Retard</span>
               <span class="cal-leg-item"><span class="cal-leg-dot-dashed"></span> Prévu</span>`
            : `<span class="cal-leg-item"><span class="cal-leg-dot-dashed"></span> Prévu</span>`;

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
                    ${legendeRetard}
                    <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#fde68a"></span> Fertile</span>
                    <span class="cal-leg-item"><span class="cal-leg-dot" style="background:#4f46e5"></span> Aujourd'hui</span>
                    <span class="cal-leg-item"><span style="color:#e83e8c">♥</span> Rapport</span>
                    <span class="cal-leg-item"><span style="color:#7c3aed">●</span> Symptômes</span>
                </div>
            </div>`;
    }

    async function naviguerCalendrier(offset) {
        if (!_moisAffiche) return;
        _moisAffiche = new Date(_moisAffiche.getFullYear(), _moisAffiche.getMonth() + offset, 1);
        _moisAffiche.setHours(0, 0, 0, 0);
        await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
        const zone = document.getElementById('cycle-calendrier');
        if (zone) zone.innerHTML = renderCalendrier(_calcCourant);
        const zoneModal = document.getElementById('cycle-calendrier-modal');
        if (zoneModal) zoneModal.innerHTML = renderCalendrier(_calcCourant);
    }

    function ouvrirCalendrier() {
        const body = `
            <div id="cycle-calendrier-modal">
                ${renderCalendrier(_calcCourant)}
            </div>
            <div style="margin-top:12px;display:flex;gap:8px">
                ${!_calcCourant?.enRetard ? `
                <button class="btn-cycle-primaire" style="flex:1"
                    onclick="Cycle.ouvrirModalAjout(null, false)">
                    + Enregistrer mes règles
                </button>` : ''}
                <button class="btn-cycle-secondaire" ${!_calcCourant?.enRetard ? '' : 'style="width:100%"'}
                    onclick="Cycle.afficherHistorique()">
                    Historique (${_cyclesCourants.length})
                </button>
            </div>`;
        document.getElementById('modal-title').textContent = 'Suivi du cycle';
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('overlay').classList.add('on');
    }

    function ouvrirJournal(dateStr) {
        const rapports    = _journalCache[dateStr] || [];
        const phaseDuJour = getPhaseDuJour(dateStr);
        const phaseLabel  = phaseDuJour ? `${phaseDuJour.emoji} ${phaseDuJour.label}` : '';

        let listeRapports = '';
        rapports.forEach((r, i) => {
            const typeLabel = r.humeur === 'non_protege' ? '🔓 Non protégé' :
                              r.humeur === 'protege'     ? '🔒 Protégé'     : r.humeur || '';
                    listeRapports += `
                                <div style="display:flex;align-items:center;justify-content:space-between;
                            background:#fdf4ff;border-radius:8px;padding:8px 10px;margin-bottom:6px">
                    <span style="font-size:13px">♥ ${typeLabel}
                        ${r.notes ? `<span style="color:#888;font-size:11px"> — ${r.notes}</span>` : ''}
                        ${r.symptomes ? `<span style="color:#7c3aed;font-size:11px"> ● ${r.symptomes}</span>` : ''}
                    </span>
                    <button onclick="Cycle._supprimerRapport(${r.id}, '${dateStr}')"
                        style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:16px">🗑</button>
                </div>`;
        });

        const body = `
            <div style="font-size:12px;color:#888;margin-bottom:4px">${dateStr}</div>
            ${phaseLabel ? `<div style="font-size:13px;color:#7c3aed;margin-bottom:12px">${phaseLabel}</div>` : ''}
            <div style="font-weight:600;font-size:13px;margin-bottom:8px">♥ Rapports enregistrés</div>
            ${listeRapports || '<div style="color:#aaa;font-size:12px;margin-bottom:8px">Aucun rapport enregistré</div>'}
            <div style="margin-top:12px">
                <div style="font-weight:600;font-size:13px;margin-bottom:8px">Ajouter un rapport</div>
                <div style="display:flex;gap:8px;margin-bottom:10px">
                    <button class="btn-rapport-type" data-type="protege"
                        onclick="Cycle._selectionnerTypeRapport(this)"
                        style="flex:1;padding:8px;border-radius:8px;border:2px solid #e5e7eb;
                               background:#fff;cursor:pointer;font-size:12px">
                        🔒 Protégé
                    </button>
                    <button class="btn-rapport-type" data-type="non_protege"
                        onclick="Cycle._selectionnerTypeRapport(this)"
                        style="flex:1;padding:8px;border-radius:8px;border:2px solid #e5e7eb;
                               background:#fff;cursor:pointer;font-size:12px">
                        🔓 Non protégé
                    </button>
                </div>
                <input id="journal-notes" type="text" placeholder="Notes (optionnel)"
                    style="width:100%;border:1px solid #e5e7eb;border-radius:8px;
                           padding:8px 10px;font-size:12px;box-sizing:border-box;margin-bottom:8px">
                <input id="journal-symptomes" type="text" placeholder="Symptômes (optionnel)"
                    style="width:100%;border:1px solid #e5e7eb;border-radius:8px;
                           padding:8px 10px;font-size:12px;box-sizing:border-box;margin-bottom:12px">
                <button onclick="Cycle._enregistrerRapport('${dateStr}')"
                    style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;
                           padding:10px;font-size:13px;font-weight:600;cursor:pointer">
                    Enregistrer
                </button>
            </div>`;

        document.getElementById('modal-title').textContent = 'Journal du ' + formatDate(parseDateLocale(dateStr));
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('overlay').classList.add('on');
    }

    function _selectionnerTypeRapport(btn) {
        document.querySelectorAll('.btn-rapport-type').forEach(b => {
            b.style.borderColor = '#e5e7eb';
            b.style.background  = '#fff';
            b.style.color       = '#333';
        });
        btn.style.borderColor = '#7c3aed';
        btn.style.background  = '#f5f3ff';
        btn.style.color       = '#7c3aed';
        btn.dataset.selected  = 'true';
    }

    async function _enregistrerRapport(dateStr) {
        const typeBtn = document.querySelector('.btn-rapport-type[data-selected="true"]');
        if (!typeBtn) { alert('Sélectionne le type de rapport.'); return; }
        const humeur    = typeBtn.dataset.type;
        const notes     = document.getElementById('journal-notes')?.value?.trim()     || null;
        const symptomes = document.getElementById('journal-symptomes')?.value?.trim() || null;
        try {
            await fetch('/api/cycle/journal', {
                method : 'POST',
                headers: authHeaders(),
                body   : JSON.stringify({ date: dateStr, humeur, notes, symptomes })
            });
            const [y, m] = dateStr.split('-').map(Number);
            await chargerJournal(m, y);
            ouvrirJournal(dateStr);
            const zone = document.getElementById('cycle-calendrier');
            if (zone) zone.innerHTML = renderCalendrier(_calcCourant);
            const zoneModal = document.getElementById('cycle-calendrier-modal');
            if (zoneModal) zoneModal.innerHTML = renderCalendrier(_calcCourant);
        } catch { alert('Erreur enregistrement.'); }
    }

    async function _supprimerRapport(id, dateStr) {
        confirmerSuppression(async () => {
            try {
                await fetch(`/api/cycle/journal/${id}`, { method: 'DELETE', headers: authHeaders() });
                const [y, m] = dateStr.split('-').map(Number);
                await chargerJournal(m, y);
                ouvrirJournal(dateStr);
                const zone = document.getElementById('cycle-calendrier');
                if (zone) zone.innerHTML = renderCalendrier(_calcCourant);
                const zoneModal = document.getElementById('cycle-calendrier-modal');
                if (zoneModal) zoneModal.innerHTML = renderCalendrier(_calcCourant);
            } catch { alert('Erreur suppression.'); }
        }, () => {
            document.getElementById('overlay').classList.remove('on');
            ouvrirJournal(dateStr);
        });
    }

    function ouvrirModalAjout(cycleExistant = null, dateReadOnly = false) {
        const aujourd_hui       = formatDateInput(_aujourdHuiLocal());
        const dureeReglesDefaut = calculerDureeReglesMoyenne(_cyclesCourants);
        const dureeDefault      = cycleExistant?.duree_regles || dureeReglesDefaut;
        const cycleDefault      = cycleExistant?.duree_cycle  || _calcCourant?.dureeCycle || 28;
        const dateDefault       = cycleExistant
            ? cycleExistant.date_debut.split('T')[0]
            : aujourd_hui;

        const body = `
            <div style="display:flex;flex-direction:column;gap:14px">
                <div>
                    <label style="font-size:12px;font-weight:600;color:#555;text-transform:uppercase;
                                  letter-spacing:.5px;display:block;margin-bottom:6px">
                        DATE DE DÉBUT DES RÈGLES *
                    </label>
                    <input type="date" id="cycle-date-debut" value="${dateDefault}"
                        ${dateReadOnly
                            ? 'readonly style="background:#f3f4f6;cursor:not-allowed;width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box"'
                            : 'style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box"'}>
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#555;text-transform:uppercase;
                                  letter-spacing:.5px;display:block;margin-bottom:6px">
                        DURÉE DES RÈGLES (JOURS)
                    </label>
                    <input type="number" id="cycle-duree-regles" value="${dureeDefault}" min="1" max="10"
                        style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;
                               font-size:14px;box-sizing:border-box">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#555;text-transform:uppercase;
                                  letter-spacing:.5px;display:block;margin-bottom:6px">
                        DURÉE DU CYCLE (JOURS) — SERA RECALCULÉE AUTOMATIQUEMENT APRÈS 2 CYCLES
                    </label>
                    <input type="number" id="cycle-duree-cycle" value="${cycleDefault}" min="20" max="45"
                        style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;
                               font-size:14px;box-sizing:border-box">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#555;text-transform:uppercase;
                                  letter-spacing:.5px;display:block;margin-bottom:6px">
                        NOTES (OPTIONNEL)
                    </label>
                    <textarea id="cycle-notes" rows="3" placeholder="Douleurs, humeur, symptômes..."
                        style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;
                               font-size:14px;box-sizing:border-box;resize:vertical"
                    >${cycleExistant?.notes || ''}</textarea>
                </div>
                <div style="display:flex;gap:10px">
                    <button onclick="Cycle._sauvegarderCycle(${cycleExistant?.id || 'null'})"
                        style="flex:1;background:#7c3aed;color:#fff;border:none;border-radius:10px;
                               padding:12px;font-size:14px;font-weight:600;cursor:pointer">
                        Enregistrer
                    </button>
                    <button onclick="document.getElementById('overlay').classList.remove('on')"
                        style="padding:12px 20px;border:1px solid #e5e7eb;border-radius:10px;
                               background:#fff;font-size:14px;cursor:pointer">
                        Annuler
                    </button>
                </div>
                ${cycleExistant ? `
                <div style="text-align:center">
                    <button onclick="Cycle._supprimerCycle(${cycleExistant.id})"
                        style="background:none;border:none;color:#e74c3c;font-size:12px;
                               cursor:pointer;text-decoration:underline">
                        Supprimer ce cycle
                    </button>
                </div>` : ''}
            </div>`;

        document.getElementById('modal-title').textContent = cycleExistant
            ? 'Modifier le cycle'
            : 'Enregistrer mes règles';
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('overlay').classList.add('on');
    }

    async function _sauvegarderCycle(idExistant = null) {
        const dateDebut   = document.getElementById('cycle-date-debut')?.value;
        const dureeRegles = parseInt(document.getElementById('cycle-duree-regles')?.value) || 3;
        const dureeCycle  = parseInt(document.getElementById('cycle-duree-cycle')?.value)  || 28;
        const notes       = document.getElementById('cycle-notes')?.value?.trim() || null;

        if (!dateDebut) { alert('La date de début est obligatoire.'); return; }

        const payload = { date_debut: dateDebut, duree_regles: dureeRegles, duree_cycle: dureeCycle, notes };
        try {
            if (idExistant) {
                await fetch(`/api/cycle/${idExistant}`, {
                    method : 'PUT',
                    headers: authHeaders(),
                    body   : JSON.stringify(payload)
                });
            } else {
                await fetch('/api/cycle', {
                    method : 'POST',
                    headers: authHeaders(),
                    body   : JSON.stringify(payload)
                });
            }
            document.getElementById('overlay').classList.remove('on');
            await init();
        } catch { alert('Erreur sauvegarde.'); }
    }

    async function _supprimerCycle(id) {
        confirmerSuppression(async () => {
            try {
                await fetch(`/api/cycle/${id}`, { method: 'DELETE', headers: authHeaders() });
                document.getElementById('overlay').classList.remove('on');
                await init();
            } catch { alert('Erreur suppression.'); }
        }, () => {
            document.getElementById('overlay').classList.remove('on');
        });
    }

    function afficherHistorique() {
        const lignes = _cyclesCourants.map(c => {
            const dateLabel = formatDate(parseDateLocale(c.date_debut.split('T')[0]));
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:12px 0;border-bottom:1px solid #f3f4f6">
                    <div>
                        <div style="font-weight:600;font-size:14px;color:#1f2937">${dateLabel}</div>
                        <div style="font-size:12px;color:#9ca3af;margin-top:2px">
                            Règles : ${c.duree_regles}j - Cycle: ${c.duree_cycle}j
                        </div>
                    </div>
                    <button onclick="Cycle.ouvrirModalAjout(${JSON.stringify(c).replace(/"/g, '&quot;')})"
                        style="background:none;border:none;cursor:pointer;font-size:18px">✏️</button>
                </div>`;
        }).join('');

        const dureeMoyenne = calculerDureeMoyenne(_cyclesCourants);
        const body = `
            <div style="background:#f5f3ff;border-radius:10px;padding:10px 14px;
                        margin-bottom:16px;font-size:13px;color:#7c3aed;font-weight:600">
                Durée moyenne calculée : ${dureeMoyenne ? `${dureeMoyenne} jours` : 'Pas encore calculée'}
            </div>
            ${lignes || '<div style="color:#aaa;font-size:13px">Aucun cycle enregistré.</div>'}
            <div style="display:flex;gap:8px;margin-top:16px">
                <button onclick="Cycle.ouvrirModalAjout()"
                    style="flex:1;background:#e91e8c;color:#fff;border:none;border-radius:10px;
                           padding:12px;font-size:13px;font-weight:600;cursor:pointer">
                    + Nouveau cycle
                </button>
                <button onclick="Cycle.ouvrirCalendrier()"
                    style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:10px;
                           background:#fff;font-size:13px;cursor:pointer">
                    ← Retour
                </button>
            </div>`;

        document.getElementById('modal-title').textContent = 'Historique des cycles';
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('overlay').classList.add('on');
    }

    function renderMoodInline(calc) {
        const aujourd_hui = _aujourdHuiLocal();
        const dateStr     = formatDateInput(aujourd_hui);
        const rapports    = _journalCache[dateStr] || [];
        const moodsHere   = rapports.filter(r => r.humeur && !['protege','non_protege'].includes(r.humeur));
        const jourCycle   = calculerJourCycle(calc);
        const phaseDef    = getPhaseMood(jourCycle, calc);

        if (!phaseDef) return '';

        const moodsActifs = moodsHere.map(r => r.humeur);
        _moodsActifsCache = moodsActifs;

        const aHumeur = moodsActifs.length > 0;

        if (aHumeur) {
            const chips = moodsActifs.map(m => {
                const icon = MOOD_ICONS[m] || '•';
                return `<span style="display:inline-flex;align-items:center;gap:4px;background:#ede9fe;
                                     color:#5b21b6;border-radius:20px;padding:4px 10px;font-size:12px;
                                     font-weight:500">${icon} ${m}</span>`;
            }).join('');
            return `
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span style="font-size:12px;color:#10b981;font-weight:600">✓ Humeur enregistrée</span>
                        <span style="font-size:12px;color:#7c3aed;cursor:pointer;text-decoration:underline"
                              onclick="Cycle._ouvrirMoodEditor('${dateStr}')">Modifier</span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div>
                    <div style="margin-top:8px;font-size:11px;color:#9ca3af;text-align:right;cursor:pointer"
                         onclick="Cycle._ouvrirGestionMood()">Cliquez pour gérer</div>
                </div>`;
        }

        return `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6">
                <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer"
                     onclick="Cycle._ouvrirMoodEditor('${dateStr}')">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:22px">🌙</span>
                        <div>
                            <div style="font-size:13px;font-weight:600;color:#1f2937">
                                Comment tu te sens aujourd'hui ?
                            </div>
                            <div style="font-size:11px;color:#7c3aed">${phaseDef.label}</div>
                        </div>
                    </div>
                    <span style="font-size:11px;color:#9ca3af">Cliquez pour gérer</span>
                </div>
            </div>`;
    }

    function _ouvrirMoodEditor(dateStr) {
        const jourCycle = calculerJourCycle(_calcCourant);
        const phaseDef  = getPhaseMood(jourCycle, _calcCourant);
        if (!phaseDef) return;

        const existants = _moodsActifsCache;

        const items = phaseDef.items.map(m => {
            const icon     = MOOD_ICONS[m] || '•';
            const selected = existants.includes(m);
            return `
                <div class="mood-chip ${selected ? 'mood-selected' : ''}"
                     data-mood="${m}"
                     onclick="Cycle._toggleMoodChip(this)"
                     style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;
                            border-radius:20px;border:2px solid ${selected ? '#7c3aed' : '#e5e7eb'};
                            background:${selected ? '#ede9fe' : '#fff'};color:${selected ? '#5b21b6' : '#555'};
                            cursor:pointer;font-size:12px;font-weight:500;margin:3px">
                    ${icon} ${m}
                </div>`;
        }).join('');

        const body = `
            <div style="font-size:12px;color:#7c3aed;font-weight:600;margin-bottom:12px">
                ${phaseDef.label}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px">${items}</div>
            <button onclick="Cycle._sauvegarderMood('${dateStr}')"
                style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;
                       padding:12px;font-size:14px;font-weight:600;cursor:pointer">
                Enregistrer mon humeur
            </button>`;

        document.getElementById('modal-title').textContent = 'Comment tu te sens ?';
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('overlay').classList.add('on');
    }

    function _toggleMoodChip(el) {
        const selected = el.classList.toggle('mood-selected');
        el.style.borderColor = selected ? '#7c3aed' : '#e5e7eb';
        el.style.background  = selected ? '#ede9fe' : '#fff';
        el.style.color       = selected ? '#5b21b6' : '#555';
    }

    async function _sauvegarderMood(dateStr) {
        const chips = document.querySelectorAll('.mood-chip.mood-selected');
        const moods = Array.from(chips).map(c => c.dataset.mood);
        if (!moods.length) { alert('Sélectionne au moins une humeur.'); return; }

        try {
            const anciens = (_journalCache[dateStr] || []).filter(r =>
                r.humeur && !['protege','non_protege'].includes(r.humeur)
            );
            for (const r of anciens) {
                await fetch(`/api/cycle/journal/${r.id}`, { method: 'DELETE', headers: authHeaders() });
            }
            for (const mood of moods) {
                await fetch('/api/cycle/journal', {
                    method : 'POST',
                    headers: authHeaders(),
                    body   : JSON.stringify({ date: dateStr, humeur: mood, notes: null, symptomes: null })
                });
            }
            const [y, m] = dateStr.split('-').map(Number);
            await chargerJournal(m, y);
            document.getElementById('overlay').classList.remove('on');
            await _rafraichirWidget();
        } catch { alert('Erreur sauvegarde humeur.'); }
    }

    function _ouvrirGestionMood() {
        const dateStr = formatDateInput(_aujourdHuiLocal());
        _ouvrirMoodEditor(dateStr);
    }

    async function _rafraichirWidget() {
        const zone = document.getElementById('cycle-widget');
        if (!zone) return;
        zone.innerHTML = await _buildWidget();
    }

    async function _buildWidget() {
        if (!_calcCourant) {
            return `
                <div style="text-align:center;padding:20px">
                    <div style="font-size:40px;margin-bottom:12px">🌸</div>
                    <div style="font-size:15px;font-weight:600;color:#1f2937;margin-bottom:8px">
                        Commence ton suivi de cycle
                    </div>
                    <div style="font-size:13px;color:#6b7280;margin-bottom:16px">
                        Enregistre tes règles pour suivre ton cycle et anticiper tes prochaines dates.
                    </div>
                    <button onclick="Cycle.ouvrirModalAjout()"
                        style="background:#e91e8c;color:#fff;border:none;border-radius:10px;
                               padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer">
                        + Enregistrer mes premières règles
                    </button>
                </div>`;
        }

        const calc      = _calcCourant;
        const phase     = getPhase(calc);
        const jourCycle = calculerJourCycle(calc);
        const progression = Math.min(100, Math.round(((jourCycle - 1) / calc.dureeCycle) * 100));

        let bandeauPhase = '';
        if (calc.enRetard) {
            bandeauPhase = renderBandeauRetard(calc);
        } else {
            bandeauPhase = `
                <div style="background:linear-gradient(135deg,#f5f3ff,#fce7f3);border-radius:12px;
                            padding:14px 16px;margin-bottom:14px;border-left:4px solid ${phase.color}">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:22px">${phase.emoji}</span>
                        <div>
                            <div style="font-weight:700;font-size:15px;color:#1f2937">${phase.label}</div>
                            ${calc.joursAvantRegles === 0
                                ? `<div style="font-size:12px;color:#e74c3c;font-weight:600">Règles attendues aujourd'hui</div>`
                                : calc.joursAvantRegles > 0
                                    ? `<div style="font-size:12px;color:#6b7280">Dans ${calc.joursAvantRegles} jour${calc.joursAvantRegles > 1 ? 's' : ''}</div>`
                                    : ''}
                        </div>
                    </div>
                </div>`;
        }

        let boutonsAction = '';
        if (!calc.enRetard) {
            boutonsAction = `
                <div style="display:flex;gap:8px;margin-top:14px">
                    <button onclick="Cycle.ouvrirModalAjout()"
                        class="btn-cycle-primaire" style="flex:1">
                        + Enregistrer mes règles
                    </button>
                    <button onclick="Cycle.afficherHistorique()"
                        class="btn-cycle-secondaire">
                        Historique (${_cyclesCourants.length})
                    </button>
                </div>`;
        } else {
            boutonsAction = `
                <div style="display:flex;gap:8px;margin-top:14px">
                    <button onclick="Cycle.afficherHistorique()"
                        class="btn-cycle-secondaire" style="width:100%">
                        Historique (${_cyclesCourants.length})
                    </button>
                </div>`;
        }

        const moodHtml = renderMoodInline(calc);

        return `
            ${bandeauPhase}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div style="background:#f9fafb;border-radius:10px;padding:10px 12px">
                    <div style="font-size:10px;font-weight:700;color:#9ca3af;
                                text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
                        📅 Dernier début
                    </div>
                    <div style="font-size:13px;font-weight:600;color:#1f2937">
                        ${formatDate(calc.debut)}
                    </div>
                </div>
                <div style="background:#f9fafb;border-radius:10px;padding:10px 12px">
                    <div style="font-size:10px;font-weight:700;color:#9ca3af;
                                text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
                        🔄 Durée cycle (calculée)
                    </div>
                    <div style="font-size:13px;font-weight:600;color:#1f2937">
                        ${calc.dureeCycle} jours
                    </div>
                </div>
                <div style="background:#f9fafb;border-radius:10px;padding:10px 12px;
                            ${calc.enRetard ? 'opacity:.4' : ''}">
                    <div style="font-size:10px;font-weight:700;color:#9ca3af;
                                text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
                        🌿 Prochaine fenêtre fertile
                    </div>
                    <div style="font-size:13px;font-weight:600;
                                color:${calc.enRetard ? '#9ca3af' : '#10b981'}">
                        ${calc.enRetard
                            ? `<span style="color:#d1d5db">-</span>`
                            : `${formatDate(calc.debutFertile)}<br>
                               <span style="font-size:11px;font-weight:400">
                                   - ${formatDate(calc.finFertile)}
                               </span>`}
                    </div>
                </div>
                <div style="background:#f9fafb;border-radius:10px;padding:10px 12px;
                            ${calc.enRetard ? 'opacity:.4' : ''}">
                    <div style="font-size:10px;font-weight:700;color:#9ca3af;
                                text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
                        ✨ Prochaine ovulation
                    </div>
                    <div style="font-size:13px;font-weight:600;
                                color:${calc.enRetard ? '#9ca3af' : '#f59e0b'}">
                        ${calc.enRetard
                            ? `<span style="color:#d1d5db">-</span>`
                            : formatDate(calc.ovulation)}
                    </div>
                </div>
            </div>
            <div style="margin-bottom:14px">
                <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;font-weight:500">
                    Progression du cycle (${calc.dureeCycle} jours)
                </div>
                <div style="background:#f3f4f6;border-radius:999px;height:8px;overflow:hidden">
                    <div style="height:100%;border-radius:999px;width:${progression}%;
                                background:${calc.enRetard
                                                                        ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                                    : 'linear-gradient(90deg,#e91e8c,#7c3aed)'}">
                    </div>
                </div>
            </div>

            ${boutonsAction}
            ${moodHtml}`;
    }

    async function init(containerId = 'cycle-widget') {
        const zone = document.getElementById(containerId);
        if (!zone) return;

        zone.innerHTML = '<div style="padding:20px;color:#9ca3af;font-size:13px">Chargement...</div>';

        try {
            const res       = await fetch('/api/cycle?limit=10', { headers: authHeaders() });
            const data      = await res.json();
            _cyclesCourants = data.cycles || [];
        } catch {
            _cyclesCourants = [];
        }

        try {
            const dureeMoyenne = calculerDureeMoyenne(_cyclesCourants);
            _calcCourant       = calculerCycle(_cyclesCourants[0], dureeMoyenne);
            _toutesLesP        = calculerToutesPeriodes(_cyclesCourants, dureeMoyenne);

            const aujourd_hui = _aujourdHuiLocal();
            _moisAffiche      = new Date(aujourd_hui.getFullYear(), aujourd_hui.getMonth(), 1);
            _moisAffiche.setHours(0, 0, 0, 0);

            await chargerJournal(aujourd_hui.getMonth() + 1, aujourd_hui.getFullYear());

            zone.innerHTML = await _buildWidget();
        } catch (e) {
            console.error('[Cycle] init error:', e);
            zone.innerHTML = '<div style="padding:20px;color:#e74c3c;font-size:13px">Erreur chargement cycle.</div>';
        }
    }

    function getDataForSocial() {
        if (!_calcCourant) return null;
        const calc      = _calcCourant;
        const phase     = getPhase(calc);
        const jourCycle = calculerJourCycle(calc);
        const phaseDef  = getPhaseMood(jourCycle, calc);
        const today     = formatDateInput(_aujourdHuiLocal());
        const rapports  = _journalCache[today] || [];
        const moods     = rapports
            .filter(r => r.humeur && !['protege','non_protege'].includes(r.humeur))
            .map(r => r.humeur);

        return {
            phase         : phase.label,
            phaseEmoji    : phase.emoji,
            jourCycle,
            dureeCycle    : calc.dureeCycle,
            prochainDebut : calc.prochainDebut,
            ovulation     : calc.ovulation,
            debutFertile  : calc.debutFertile,
            finFertile    : calc.finFertile,
            enRetard      : calc.enRetard,
            joursRetard   : calc.joursRetard,
            moods,
            phaseMoodLabel: phaseDef?.label || '',
        };
    }

    return {
        init,
        charger                : init,
        ouvrirCalendrier,
        ouvrirModalCalendrier  : ouvrirCalendrier,
        ouvrirJournal,
        ouvrirModalAjout,
        afficherHistorique,
        naviguerCalendrier,
        getDataForSocial,
        _signalerRetard,
        _supprimerRapport,
        _enregistrerRapport,
        _selectionnerTypeRapport,
        _toggleMoodChip,
        _sauvegarderMood,
        _ouvrirMoodEditor,
        _ouvrirGestionMood,
        _sauvegarderCycle,
        _supprimerCycle,
    };

})();
