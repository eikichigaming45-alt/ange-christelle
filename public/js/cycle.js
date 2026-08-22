// ============================================================
// public/js/cycle.js
// Suivi du cycle menstruel — widget, calendrier, journal, mood.
// Auth via JWT Bearer (authHeaders). Pas d'userId client.
// Phases mood calculées dynamiquement selon dureeRegles/dureeCycle.
// ============================================================

const Cycle = (() => {

    const PAGE_SIZE = 10;

    const PHASES_MOOD_DEF = [
        {
            label: '🌑 Règles - Énergie basse',
            items: ['Fatiguée','Irritée','Sensibilité haute','Besoin de repos',
                    'Moins sociable','Lourdeur corporelle','Manque de motivation']
        },
        {
            label: '🌱 Folliculaire - Montée d\'énergie',
            items: ['Motivée','Stable','Optimiste','Concentrée',
                    'Sociable','Créative','Confiance tranquille']
        },
        {
            label: '☀️ Ovulation - Pic de confiance',
            items: ['Confiance max','Énergie haute','Charme naturel','Très sociable',
                    'Décisive','Bonne humeur','Aisance relationnelle']
        },
        {
            label: '🌙 Lutéale début - Calme',
            items: ['Apaisée','Ralentissement','Besoin de douceur',
                    'Moins dans le rush','Patiente','Introspective']
        },
        {
            label: '🌙 Lutéale fin - SPM',
            items: ['Irritabilité','Hypersensibilité','Stress facile','Baisse d\'énergie',
                    'Besoin d\'isolement','Moins de patience','Pensées négatives','Sensation de surcharge']
        }
    ];

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

    function calculerCycle(dernierCycle, dureeMoyenne) {
        if (!dernierCycle) return null;
        const debut         = parseDateLocale(dernierCycle.date_debut.split('T')[0]);
        const dureeRegles   = dernierCycle.duree_regles || 5;
        const dureeCycle    = dureeMoyenne || dernierCycle.duree_cycle || 28;
        const finRegles     = addDays(debut, dureeRegles - 1);
        const prochainDebut = addDays(debut, dureeCycle);
        const debutFertile  = addDays(debut, dureeCycle - 16);
        const finFertile    = addDays(debut, dureeCycle - 12);
        const ovulation     = addDays(debut, dureeCycle - 14);
        const aujourd_hui   = new Date(); aujourd_hui.setHours(0, 0, 0, 0);
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
        const aujourd_hui = new Date(); aujourd_hui.setHours(0, 0, 0, 0);
        if (calc.enRegles)  return { label: 'Règles en cours', emoji: '🔴', color: '#e74c3c' };
        if (calc.enFenetre) return { label: 'Fenêtre fertile',  emoji: '🟢', color: '#2ecc71' };
        if (memeJour(aujourd_hui, calc.ovulation)) return { label: "Jour d'ovulation", emoji: '🌟', color: '#f39c12' };
        const jourCycle    = Math.round((aujourd_hui - calc.debut) / (1000 * 60 * 60 * 24)) + 1;
        const debutLuteale = calc.dureeCycle - 14;
        const debutSPM     = calc.dureeCycle - 7;
        if (jourCycle >= debutSPM)        return { label: 'Lutéale fin — SPM',    emoji: '🌙', color: '#8b5cf6' };
        if (jourCycle >= debutLuteale)    return { label: 'Phase lutéale',         emoji: '🌙', color: '#a78bfa' };
        if (jourCycle > calc.dureeRegles) return { label: 'Phase folliculaire',    emoji: '🌱', color: '#10b981' };
        return { label: 'Phase de repos', emoji: '🔵', color: '#3498db' };
    }

    function calculerJourCycle(calc) {
        if (!calc) return null;
        const aujourd_hui = new Date(); aujourd_hui.setHours(0, 0, 0, 0);
        return Math.round((aujourd_hui - calc.debut) / (1000 * 60 * 60 * 24)) + 1;
    }

    async function chargerJournal(mois, annee) {
        try {
            const res = await fetch(`/api/cycle/journal?mois=${mois}&annee=${annee}`, { headers: authHeaders() });
            const d   = await res.json();
            _journalCache = {};
            (d.journal || []).forEach(r => { _journalCache[r.date.split('T')[0]] = r; });
        } catch { _journalCache = {}; }
    }

    function renderCalendrier(calc) {
        const aujourd_hui = new Date(); aujourd_hui.setHours(0, 0, 0, 0);
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
            const journal       = _journalCache[dateStr];
            const aRapport      = journal?.humeur === 'protege' || journal?.humeur === 'non_protege';
            const aSymptomes    = journal?.symptomes;

            let cls   = 'cal-day';
            let badge = '';
            let icons = '';

            if (estRegles)       cls  += ' cal-regles';
            else if (estFertile) cls  += ' cal-fertile';
            if (estAujourdhui)   cls  += ' cal-today';
            if (estOvul)         badge = '<span class="cal-ovulation-star">★</span>';
            if (aRapport)        icons += `<span class="cal-icon-rapport ${journal.humeur === 'protege' ? 'protege' : 'non-protege'}">♥</span>`;
            if (aSymptomes)      icons += `<span class="cal-icon-symptome">●</span>`;

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

    async function ouvrirJournal(dateStr) {
        const journal = _journalCache[dateStr] || null;
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateAff = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });

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

        let contenu = '';

        if (journal) {
            const rapport   = journal.humeur;
            const symptomes = journal.symptomes ? journal.symptomes.split(',').filter(Boolean) : [];
            const notes     = journal.notes || '';
            const heure     = journal.created_at
                ? new Date(journal.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : null;

            if (heure) {
                contenu += `<div style="font-size:11px;color:#9ca3af;margin-bottom:14px">Enregistré à ${heure}</div>`;
            }

            if (rapport) {
                const rapportLabel = rapport === 'protege' ? '🛡️ Protégé' : '♥ Non protégé';
                contenu += `
                    <div style="margin-bottom:12px">
                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:6px">Rapport sexuel</div>
                        <span style="background:#fce7f3;color:#db2777;border-radius:20px;
                                     padding:5px 12px;font-size:13px;font-weight:600">${rapportLabel}</span>
                    </div>`;
            }

            if (symptomes.length > 0) {
                contenu += `
                    <div style="margin-bottom:12px">
                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:6px">Symptômes</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">
                            ${symptomes.map(s =>
                                `<span style="background:#ede9fe;color:#7c3aed;border-radius:20px;
                                              padding:4px 10px;font-size:12px;font-weight:600">
                                    ${LABELS_SYMPTOMES[s] || s}
                                </span>`
                            ).join('')}
                        </div>
                    </div>`;
            }

            if (notes) {
                contenu += `
                    <div style="margin-bottom:12px">
                        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                                    letter-spacing:.5px;margin-bottom:6px">Notes</div>
                        <div style="font-size:13px;color:#374151;line-height:1.5">${notes}</div>
                    </div>`;
            }

            if (!rapport && symptomes.length === 0 && !notes) {
                contenu += `<p style="color:#9ca3af;font-size:13px">Aucune donnée enregistrée.</p>`;
            }
        } else {
            contenu = `<p style="color:#9ca3af;font-size:13px;margin-bottom:4px">Aucun enregistrement pour ce jour.</p>`;
        }

        document.getElementById('modal-title').textContent = dateAff;
        document.getElementById('modal-body').innerHTML = `
            <div class="journal-form">
                ${contenu}
                <div class="modal-actions" style="margin-top:16px">
                    <button class="btn-save" onclick="Cycle._ouvrirFormulaireJournal('${dateStr}')">
                        + Enregistrer un rapport
                    </button>
                    ${journal?.id
                        ? `<button class="btn-delete" onclick="Cycle._supprimerJournal(${journal.id}, '${dateStr}')">🗑️ Supprimer</button>`
                        : ''}
                    <button class="btn-cancel" onclick="Cycle.ouvrirModalCalendrier()">Retour</button>
                </div>
            </div>`;
        document.getElementById('overlay').classList.add('on');
    }

    async function _ouvrirFormulaireJournal(dateStr) {
        const journal = _journalCache[dateStr] || {};
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateAff = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
        const symptomesActifs = journal.symptomes ? journal.symptomes.split(',') : [];

        const SYMPTOMES = [
            { key: 'je_me_sens_bien',     label: 'Je me sens bien',     icon: '😊' },
            { key: 'crampes_abdominales', label: 'Crampes abdominales', icon: '🤰' },
            { key: 'seins_douloureux',    label: 'Seins douloureux',    icon: '👙' },
            { key: 'douleurs_lombaires',  label: 'Douleurs lombaires',  icon: '🔙' },
            { key: 'pertes_claires',      label: 'Pertes claires',      icon: '💧' },
            { key: 'fievre',              label: 'Fièvre',              icon: '🌡️' },
            { key: 'fatigue',             label: 'Fatigue',             icon: '😴' },
            { key: 'humeur_irritable',    label: 'Humeur irritable',    icon: '😤' },
        ];

        document.getElementById('modal-title').textContent = 'Enregistrer un rapport sexuel';
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
                    ${SYMPTOMES.map(s => `
                        <label class="symptome-chip ${symptomesActifs.includes(s.key) ? 'active' : ''}"
                            onclick="var cb=this.querySelector('input');cb.checked=!cb.checked;this.classList.toggle('active',cb.checked)">
                            <input type="checkbox" value="${s.key}" ${symptomesActifs.includes(s.key) ? 'checked' : ''}>
                            <span class="symptome-chip-icon">${s.icon}</span>
                            <span class="symptome-chip-label">${s.label}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="journal-section-title" style="margin-top:14px">Notes libres</div>
                <textarea id="journal-notes" rows="3" placeholder="Autre chose à noter...">${journal.notes || ''}</textarea>
                <div class="modal-actions" style="margin-top:16px">
                    <button class="btn-save" onclick="Cycle._sauvegarderJournal('${dateStr}')">💾 Sauvegarder</button>
                    ${journal.id ? `<button class="btn-delete" onclick="Cycle._supprimerJournal(${journal.id}, '${dateStr}')">🗑️ Supprimer</button>` : ''}
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

    async function _sauvegarderJournal(dateStr) {
        const rapportBtn = document.querySelector('.btn-rapport.active');
        const rapport    = rapportBtn
            ? (rapportBtn.textContent.includes('Protégé') ? 'protege' : 'non_protege')
            : null;
        const symptomes = [...document.querySelectorAll('.journal-symptomes input:checked')]
            .map(i => i.value).join(',');
        const notes = document.getElementById('journal-notes').value;
        try {
            await fetch('/api/cycle/journal', {
                method : 'POST',
                headers: authHeaders(),
                body   : JSON.stringify({ date: dateStr, rapport, symptomes, notes })
            });
            await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
            ouvrirJournal(dateStr);
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur lors de la sauvegarde.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="Cycle._ouvrirFormulaireJournal('${dateStr}')">Retour</button>
                </div>`;
        }
    }

    async function _supprimerJournal(id, dateStr) {
        confirmerSuppression(
            async () => {
                try {
                    await fetch(`/api/cycle/journal/${id}`, { method: 'DELETE', headers: authHeaders() });
                    await chargerJournal(_moisAffiche.getMonth() + 1, _moisAffiche.getFullYear());
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

        async function ouvrirModalMood(calc) {
        const today     = formatDateInput(new Date());
        const jourCycle = calculerJourCycle(calc);
        const phaseMood = getPhaseMood(jourCycle, calc);

        let moodsActifs = [];
        try {
            const res = await fetch(`/api/cycle/mood?date=${today}`, { headers: authHeaders() });
            const d   = await res.json();
            if (d.mood?.moods) moodsActifs = d.mood.moods.split(',').filter(Boolean);
        } catch { /* silencieux */ }

        document.getElementById('modal-title').textContent = 'Comment je me sens ?';
        document.getElementById('modal-body').innerHTML = `
            <div class="journal-form">
                ${phaseMood ? `
                    <div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:14px;
                                background:#f5f3ff;border-radius:10px;padding:10px 14px">
                        ${phaseMood.label}
                        <div style="font-size:11px;font-weight:400;color:#9ca3af;margin-top:4px">
                            J${jourCycle} · Règles ${calc.dureeRegles}j · Cycle ${calc.dureeCycle}j
                        </div>
                    </div>` : ''}
                <div class="journal-symptomes">
                    ${(phaseMood?.items || []).map(item => `
                        <label class="symptome-chip ${moodsActifs.includes(item) ? 'active' : ''}"
                            onclick="var cb=this.querySelector('input');cb.checked=!cb.checked;this.classList.toggle('active',cb.checked)">
                            <input type="checkbox" value="${item}" ${moodsActifs.includes(item) ? 'checked' : ''}>
                            <span class="symptome-chip-label">${item}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="modal-actions" style="margin-top:16px">
                    <button class="btn-save" onclick="Cycle._sauvegarderMood('${today}')">💾 Sauvegarder</button>
                    <button class="btn-cancel" onclick="closeModal()">Annuler</button>
                </div>
            </div>`;
        document.getElementById('overlay').classList.add('on');
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

    function renderBlocMood(moodDuJour, calc, onclickFn) {
        if (!calc) return '';
        const jourCycle    = calculerJourCycle(calc);
        const phaseMood    = getPhaseMood(jourCycle, calc);
        const moodsRemplis = moodDuJour?.moods ? moodDuJour.moods.split(',').filter(Boolean) : [];

        return `
            <div style="margin-top:14px;background:#f5f3ff;border-radius:12px;padding:12px 14px">
                ${moodsRemplis.length > 0 ? `
                    <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;
                                text-transform:uppercase;letter-spacing:.5px">
                        ${phaseMood?.label || 'Mon humeur du jour'}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
                        ${moodsRemplis.map(m =>
                            `<span style="background:#ede9fe;color:#7c3aed;border-radius:20px;
                                          padding:4px 10px;font-size:12px;font-weight:600">${m}</span>`
                        ).join('')}
                    </div>
                    <button class="btn-cycle-secondary" style="width:100%;font-size:12px"
                        onclick="${onclickFn}">
                        ✏️ Modifier mon humeur
                    </button>
                ` : `
                    <div style="font-size:13px;color:#6b7280;margin-bottom:10px">
                        Comment tu te sens aujourd'hui ? 🌸
                    </div>
                    <button class="btn-cycle-primary" style="width:100%;font-size:13px"
                        onclick="${onclickFn}">
                        + Enregistrer mon humeur
                    </button>
                `}
            </div>`;
    }

    function renderWidget(cycles, dureeMoyenne, moodDuJour) {
        const dernierCycle = cycles.length > 0 ? cycles[0] : null;
        const calc         = calculerCycle(dernierCycle, dureeMoyenne);
        const phase        = getPhase(calc);

        let labelOvulation, valeurOvulation, labelFenetre, valeurFenetre;
        if (calc) {
            const aujourd_hui = new Date(); aujourd_hui.setHours(0, 0, 0, 0);
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
                        <div class="cycle-progress-fill" style="width:${Math.min(100, Math.max(0, Math.round(((new Date() - calc.debut) / (1000 * 60 * 60 * 24)) / calc.dureeCycle * 100)))}%;background:${phase.color}"></div>
                    </div>
                </div>` : ''}
                <div class="cycle-actions">
                    <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">+ Enregistrer mes règles</button>
                    ${cycles.length > 0 ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">Historique (${cycles.length})</button>` : ''}
                </div>
                ${renderBlocMood(moodDuJour, calc, "Cycle._ouvrirMoodDepuisWidget()")}
            </div>`;
    }

    async function _ouvrirMoodDepuisWidget() {
        try {
            const res          = await fetch('/api/cycle', { headers: authHeaders() });
            const d            = await res.json();
            const cycles       = d.cycles || [];
            const dureeMoyenne = calculerDureeMoyenne(cycles);
            const dernierCycle = cycles.length > 0 ? cycles[0] : null;
            const calc         = calculerCycle(dernierCycle, dureeMoyenne);
            await ouvrirModalMood(calc);
        } catch {
            document.getElementById('modal-title').textContent = 'Erreur';
            document.getElementById('modal-body').innerHTML = `
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur de chargement.</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Fermer</button>
                </div>`;
        }
    }

    async function charger() {
        const container = document.getElementById('widget-cycle-content');
        if (!container) return;
        const user = JSON.parse(localStorage.getItem('myvibe_user'));
        if (!user?.token) { setTimeout(() => charger(), 300); return; }
        try {
            const res          = await fetch('/api/cycle', { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const d            = await res.json();
            const cycles       = d.cycles || [];
            const dureeMoyenne = calculerDureeMoyenne(cycles);

            const today    = formatDateInput(new Date());
            let moodDuJour = null;
            try {
                const resMood = await fetch(`/api/cycle/mood?date=${today}`, { headers: authHeaders() });
                const dMood   = await resMood.json();
                moodDuJour    = dMood.mood || null;
            } catch { /* silencieux */ }

            container.innerHTML = renderWidget(cycles, dureeMoyenne, moodDuJour);
        } catch {
            container.innerHTML = `<p class="cycle-error">Erreur de chargement du cycle.</p>`;
        }
    }

    // ── Modal calendrier : PAS de bloc mood ici, uniquement dans le widget ──
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
            _moisAffiche = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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
                        <button class="btn-cycle-primary" onclick="Cycle.ouvrirModalAjout()">+ Enregistrer mes règles</button>
                        ${cycles.length > 0
                            ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique()">Historique (${cycles.length})</button>`
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
        const today  = formatDateInput(new Date());
        document.getElementById('modal-title').textContent = isEdit ? 'Modifier le cycle' : 'Enregistrer mes règles';
        document.getElementById('modal-body').innerHTML = `
            <div class="modal-cycle-form">
                <label>Date de début des règles *</label>
                <input type="date" id="cycle-date-debut"
                    value="${isEdit ? formatDateInput(parseDateLocale(cycleExistant.date_debut.split('T')[0])) : today}"
                    max="${today}" />
                <label>Durée des règles (jours)</label>
                <input type="number" id="cycle-duree-regles" min="1" max="10"
                    value="${isEdit ? cycleExistant.duree_regles : 5}" />
                <label>Durée du cycle (jours) — sera recalculée automatiquement après 2 cycles</label>
                <input type="number" id="cycle-duree-cycle" min="21" max="45"
                    value="${isEdit ? cycleExistant.duree_cycle : 28}" />
                <label>Notes (optionnel)</label>
                <textarea id="cycle-notes" rows="3" placeholder="Douleurs, humeur, symptômes...">${isEdit ? (cycleExistant.notes || '') : ''}</textarea>
                <div class="modal-actions">
                    <button class="btn-save" onclick="Cycle.sauvegarder(${isEdit ? cycleExistant.id : 'null'})">
                        ${isEdit ? 'Modifier' : 'Enregistrer'}
                    </button>
                    ${isEdit ? `<button class="btn-delete" onclick="Cycle.supprimer(${cycleExistant.id})">Supprimer</button>` : ''}
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
                    <button class="btn-cancel" onclick="Cycle.ouvrirModalAjout(${id ? id : 'null'})">Retour</button>
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
                        ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique(${page - 1})">← Précédent</button>`
                        : ''}
                    <span>${page + 1} / ${totalPages}</span>
                    ${page < totalPages - 1
                        ? `<button class="btn-cycle-secondary" onclick="Cycle.ouvrirHistorique(${page + 1})">Suivant →</button>`
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
                <p style="color:#ef4444;font-size:15px;margin-bottom:20px">Erreur de chargement de l'historique.</p>
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
        _ouvrirMoodDepuisWidget,
        _getCalcCourant
    };

})();
