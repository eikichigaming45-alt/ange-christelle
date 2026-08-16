// ===================== GRID & DRAG DROP =====================

let gridConstruit = false;

async function buildGrid() {
    if (gridConstruit) return;
    gridConstruit = true;

    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const grid = document.getElementById('main-grid');
    grid.innerHTML = '';
    let ordre = null;

    // Charger widgets visibles + ordre en parallèle
    const token = localStorage.getItem('token');
    let actifs = null;

    try {
        const [rOrdre, rWidgets] = await Promise.all([
            fetch(`/api/widget-order?userId=${user.userId}`),
            fetch('/api/profil/widgets-visibles', { headers: { 'Authorization': 'Bearer ' + token } })
        ]);
        const dOrdre   = await rOrdre.json();
        const dWidgets = await rWidgets.json();
        if (dOrdre.success && dOrdre.ordre) ordre = dOrdre.ordre;
        actifs = dWidgets.widgets_visibles || null;
    } catch(e) {}

    let defs = [...WIDGETS_DEF];
    if (user?.role === 'admin') {
        defs.push({ id:'admin', label:'Administration', icon:'⚙️', cls:'w-admin', desc:'Gérer les utilisateurs et les paramètres', foot:'Accès admin' });
    }

    // Appliquer l'ordre sauvegardé
    if (ordre) {
        const sorted = [];
        ordre.forEach(id => { const w = defs.find(d => d.id === id); if(w) sorted.push(w); });
        defs.forEach(w => { if(!ordre.includes(w.id)) sorted.push(w); });
        defs = sorted;
    }

    // 🔒 FILTRAGE ROBUSTE DES WIDGETS VISIBLES
    const TOUJOURS_VISIBLES = ['profil', 'admin'];
    if (Array.isArray(actifs)) {
        defs = defs.filter(w => TOUJOURS_VISIBLES.includes(w.id) || actifs.includes(w.id));
    }

    defs.forEach(def => grid.appendChild(creerWidget(def)));

    if (typeof Cycle !== 'undefined') Cycle.charger();
    if (typeof Rendezvous !== 'undefined') Rendezvous.charger();
}

function creerWidget(def) {
    const div = document.createElement('div');
    div.className = `widget ${def.cls}`;
    div.dataset.id = def.id;
    div.draggable = true;

    let contentHtml = def.desc;
    if (def.id === 'cycle')      contentHtml = '<div id="widget-cycle-content">Chargement...</div>';
    if (def.id === 'rendezvous') contentHtml = '<div id="widget-rdv-content">Chargement...</div>';

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
        <div class="wf">${def.foot}</div>
    `;

    div.addEventListener('click', e => {
        if (e.target.classList.contains('drag-handle') || e.target.classList.contains('rbtn') || e.target.closest('button')) return;
        if (e.target.closest('.rdv-card')) return;
        openModal(def.id);
    });

    if (def.id === 'meteo')      div.querySelector('#rbtn-meteo')?.addEventListener('click',      e => { e.stopPropagation(); chargerMeteoAuto(); });
    if (def.id === 'priere')     div.querySelector('#rbtn-priere')?.addEventListener('click',     e => { e.stopPropagation(); chargerPriere(); });
    if (def.id === 'cycle')      div.querySelector('#rbtn-cycle')?.addEventListener('click',      e => { e.stopPropagation(); Cycle.charger(); });
    if (def.id === 'rendezvous') div.querySelector('#rbtn-rendezvous')?.addEventListener('click', e => { e.stopPropagation(); Rendezvous.charger(); });

    div.addEventListener('dragstart', onDragStart);
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('dragleave', onDragLeave);
    div.addEventListener('drop',      onDrop);
    div.addEventListener('dragend',   onDragEnd);
    ajouterTouchDrag(div);
    return div;
}

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
    const grid = document.getElementById('main-grid');
    const widgets = [...grid.children];
    const si = widgets.indexOf(dragSrc), ti = widgets.indexOf(this);
    if (si < ti) grid.insertBefore(dragSrc, this.nextSibling); else grid.insertBefore(dragSrc, this);
    sauvegarderOrdre();
}

function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
}

function ajouterTouchDrag(el) {
    let startX, startY, clone, origRect;
    el.addEventListener('touchstart', e => {
        dragActif = false;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        longPressTimer = setTimeout(() => {
            dragActif = true;
            origRect = el.getBoundingClientRect();
            clone = el.cloneNode(true);
            clone.style.cssText = `position:fixed;z-index:9999;opacity:.75;pointer-events:none;width:${origRect.width}px;left:${origRect.left}px;top:${origRect.top}px;margin:0;transition:none;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.2);`;
            document.body.appendChild(clone);
            el.classList.add('dragging');
            dragSrc = el;
            if (navigator.vibrate) navigator.vibrate(40);
        }, 500);
    }, {passive:true});

    el.addEventListener('touchmove', e => {
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (!dragActif && (dx > 8 || dy > 8)) { clearTimeout(longPressTimer); return; }
        if (!dragActif) return;
        e.preventDefault();
        const moveX = t.clientX - startX;
        const moveY = t.clientY - startY;
        clone.style.left = (origRect.left + moveX) + 'px';
        clone.style.top  = (origRect.top  + moveY) + 'px';
        clone.style.display = 'none';
        const below = document.elementFromPoint(t.clientX, t.clientY);
        clone.style.display = '';
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el) target.classList.add('drag-over');
    }, {passive:false});

    el.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (!dragActif) return;
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        const t = event.changedTouches?.[0];
        const below = t ? document.elementFromPoint(t.clientX, t.clientY) : null;
        const target = below?.closest('.widget');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        if (target && target !== el) {
            const grid = document.getElementById('main-grid');
            const widgets = [...grid.children];
            const si = widgets.indexOf(el), ti = widgets.indexOf(target);
            if (si < ti) grid.insertBefore(el, target.nextSibling); else grid.insertBefore(el, target);
            sauvegarderOrdre();
        }
    }, {passive:true});

    el.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        if (clone) clone.remove();
        el.classList.remove('dragging');
        dragActif = false;
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    }, {passive:true});
}

async function sauvegarderOrdre() {
    const user = JSON.parse(localStorage.getItem('myvibe_user'));
    const ordre = [...document.querySelectorAll('.widget')].map(w => w.dataset.id);
    try {
        await fetch('/api/widget-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, ordre })
        });
    } catch(e) {}
}

// ===================== WIDGETS VISIBLES =====================

function appliquerWidgetsVisibles(actifs) {
    const TOUJOURS_VISIBLES = ['profil', 'admin'];
    const grid = document.getElementById('main-grid');
    if (!grid) return;
    [...grid.children].forEach(el => {
        const id = el.dataset.id;
        if (!id) return;
        if (TOUJOURS_VISIBLES.includes(id)) return;
        el.style.display = actifs.includes(id) ? '' : 'none';
    });
}
