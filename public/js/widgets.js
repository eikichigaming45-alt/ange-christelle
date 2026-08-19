// ============================================================
// public/js/widgets.js
// Grille principale, drag & drop souris + tactile, opt-out widgets.
// Dépend de : app.js (WIDGETS_DEF, dragSrc, dragActif, longPressTimer)
// ============================================================

let gridConstruit = false;

// ===================== CONSTRUCTION DE LA GRILLE =============

async function buildGrid() {
    if (gridConstruit) return;
    gridConstruit = true;

    const user  = getUser();
    const token = user?.token;
    const grid  = document.getElementById('main-grid');
    grid.innerHTML = '';

    let ordre         = null;
    let widgetsCaches = [];

    try {
        const [rOrdre, rWidgets] = await Promise.all([
            fetch('/api/widget-order', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('/api/profil/widgets-visibles', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        const dOrdre   = await rOrdre.json();
        const dWidgets = await rWidgets.json();
        if (dOrdre.success && dOrdre.ordre)                             ordre         = dOrdre.ordre;
        if (dWidgets.success && Array.isArray(dWidgets.widgets_caches)) widgetsCaches = dWidgets.widgets_caches;
    } catch { /* silencieux — grille chargée avec valeurs par défaut */ }

    // Ajout du widget admin si rôle admin
    let defs = [...WIDGETS_DEF];
    if (user?.role === 'admin') {
        defs.push({
            id   : 'admin',
            label: 'Administration',
            icon : '⚙️',
            cls  : 'w-admin',
            desc : 'Gérer les utilisateurs et les paramètres',
            foot : 'Cliquez pour gérer'
        });
    }

    // Tri selon l'ordre sauvegardé
    if (ordre) {
        const sorted = [];
        ordre.forEach(id => { const w = defs.find(d => d.id === id); if (w) sorted.push(w); });
        defs.forEach(w  => { if (!ordre.includes(w.id)) sorted.push(w); });
        defs = sorted;
    }

    // Filtrage opt-out
    const TOUJOURS_VISIBLES = ['profil'];
    defs = defs.filter(w => {
        if (w.id === 'admin')                 return user?.role === 'admin';
        if (TOUJOURS_VISIBLES.includes(w.id)) return true;
        return !widgetsCaches.includes(w.id);
    });

    defs.forEach(def => grid.appendChild(creerWidget(def)));

    if (typeof chargerProfilHeader   === 'function') chargerProfilHeader();
    if (typeof Cycle                 !== 'undefined') Cycle.charger();
    if (typeof Rendezvous            !== 'undefined') Rendezvous.charger();
    if (typeof chargerWidgetPlanning === 'function') chargerWidgetPlanning();
}

// ===================== CRÉATION D'UN WIDGET ==================

function creerWidget(def) {
    const div      = document.createElement('div');
    div.className  = `widget ${def.cls}`;
    div.dataset.id = def.id;
    div.draggable  = true;

    let contentHtml = def.desc || '';
    if (def.id === 'cycle')       contentHtml = '<div id="widget-cycle-content">Chargement...</div>';
    if (def.id === 'rendezvous')  contentHtml = '<div id="widget-rdv-content">Chargement...</div>';
    if (def.id === 'planning')    contentHtml = '<div id="widget-planning-contenu">Chargement...</div>';
    if (def.id === 'profil')      contentHtml = '<div id="wc-profil"></div>';
    if (def.id === 'astrologie')  contentHtml = '<div id="wc-astrologie">Chargement...</div>';

    div.innerHTML = `
        <span class="drag-handle" title="Déplacer">⠿</span>
        <div class="wh">
            <div class="whl">
                <div class="wi" id="wi-${def.id}">${def.icon}</div>
                <div class="wt">${def.label}</div>
            </div>
            ${def.refresh ? `<button class="rbtn" id="rbtn-${def.id}" title="Actualiser">🔄</button>` : ''}
        </div>
        <div class="wc" id="wc-${def.id}">${contentHtml}</div>
        <div class="wf">${def.foot || ''}</div>
    `;

    // Clic sur le widget → ouvre la modale
    div.addEventListener('click', e => {
        if (e.target.classList.contains('drag-handle')) return;
        if (e.target.classList.contains('rbtn'))        return;
        if (e.target.closest('button'))                 return;
        if (e.target.closest('.rdv-card'))              return;
        openModal(def.id);
    });

    // Boutons de rafraîchissement
    if (def.id === 'meteo')       div.querySelector('#rbtn-meteo')?.addEventListener('click',       e => { e.stopPropagation(); chargerMeteoAuto(); });
    if (def.id === 'priere')      div.querySelector('#rbtn-priere')?.addEventListener('click',      e => { e.stopPropagation(); chargerPriere(); });
    if (def.id === 'islam')       div.querySelector('#rbtn-islam')?.addEventListener('click',       e => { e.stopPropagation(); if (typeof window.chargerIslam === 'function') window.chargerIslam(); });
    if (def.id === 'cycle')       div.querySelector('#rbtn-cycle')?.addEventListener('click',       e => { e.stopPropagation(); Cycle.charger(); });
    if (def.id === 'rendezvous')  div.querySelector('#rbtn-rendezvous')?.addEventListener('click',  e => { e.stopPropagation(); Rendezvous.charger(); });
    // ✅ Refresh astrologie
    if (def.id === 'astrologie')  div.querySelector('#rbtn-astrologie')?.addEventListener('click',  e => { e.stopPropagation(); if (typeof chargerAstrologie === 'function') chargerAstrologie(); });

    // Drag & drop souris
    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('dragleave', onDragLeave);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);

    // Drag & drop tactile
    ajouterTouchDrag(div);

    return div;
}

// ===================== DRAG & DROP SOURIS ====================

function onDragStart(e) {
    dragSrc = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== dragSrc) this.classList.add('drag-over');
}

function onDragLeave() {
    this.classList.remove('drag-over');
}

function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (this === dragSrc) return;
    const grid    = document.getElementById('main-grid');
    const widgets = [...grid.children];
    const si      = widgets.indexOf(dragSrc);
    const ti      = widgets.indexOf(this);
    if (si < ti) grid.insertBefore(dragSrc, this.nextSibling);
    else         grid.insertBefore(dragSrc, this);
    sauvegarderOrdre();
}

function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
}

// ===================== DRAG & DROP TACTILE ===================

function ajouterTouchDrag(el) {
    let startX, startY, clone, origRect;

    el.addEventListener('touchstart', e => {
        dragActif = false;
        const t   = e.touches[0];
        startX    = t.clientX;
        startY    = t.clientY;
        longPressTimer = setTimeout(() => {
            dragActif = true;
            origRect  = el.getBoundingClientRect();
            clone     = el.cloneNode(true);
            clone.style.cssText = `
                position:fixed;z-index:9999;opacity:.75;pointer-events:none;
                width:${origRect.width}px;left:${origRect.left}px;top:${origRect.top}px;
                margin:0;transition:none;border-radius:16px;
                box-shadow:0 12px 32px rgba(0,0,0,.2);
            `;
            document.body.appendChild(clone);
            el.classList.add('dragging');
            dragSrc = el;
            if (navigator.vibrate) navigator.vibrate(40);
        }, 500);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        const t  = e.touches[0];
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (!dragActif && (dx > 8 || dy > 8)) { clearTimeout(longPressTimer); return; }
        if (!dragActif) return;
        e.preventDefault();
        clone.style.left = (origRect.left + t.clientX - startX) + 'px';
        clone.style.top  = (origRect.top  + t.clientY - startY) + 'px';
        clone.style.display = 'none';
        const below  = document.elementFromPoint(t.clientX, t.clientY);
        clone.style.display = '';
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el) target.classList.add('drag-over');
    }, { passive: false });

    el.addEventListener('touchend', e => {
        clearTimeout(longPressTimer);
        if (!dragActif) return;
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        const t      = e.changedTouches?.[0];
        const below  = t ? document.elementFromPoint(t.clientX, t.clientY) : null;
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el) {
            const grid    = document.getElementById('main-grid');
            const widgets = [...grid.children];
            const si      = widgets.indexOf(el);
            const ti      = widgets.indexOf(target);
            if (si < ti) grid.insertBefore(el, target.nextSibling);
            else         grid.insertBefore(el, target);
            sauvegarderOrdre();
        }
    }, { passive: true });

    el.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    }, { passive: true });
}

// ===================== SAUVEGARDE ORDRE ======================

async function sauvegarderOrdre() {
    const user  = getUser();
    const ordre = [...document.querySelectorAll('.widget')].map(w => w.dataset.id);
    try {
        await fetch('/api/widget-order', {
            method  : 'POST',
            headers : {
                'Content-Type'  : 'application/json',
                'Authorization' : `Bearer ${user?.token}`
            },
            body: JSON.stringify({ ordre })
        });
    } catch { /* silencieux — non critique */ }
}

// ===================== APPLIQUER WIDGETS VISIBLES ============

function appliquerWidgetsVisibles(widgetsCaches) {
    const user              = getUser();
    const TOUJOURS_VISIBLES = user?.role === 'admin'
        ? ['profil', 'admin']
        : ['profil'];
    const grid = document.getElementById('main-grid');
    if (!grid) return;
    [...grid.children].forEach(el => {
        const id = el.dataset.id;
        if (!id)                              return;
        if (TOUJOURS_VISIBLES.includes(id))   return;
        el.style.display = widgetsCaches.includes(id) ? 'none' : '';
    });
}
