// ===================== WIDGET PRIERE =====================

async function chargerPriere() {
    const el = document.getElementById('wc-priere');
    if (el) el.textContent = 'Chargement...';
    try {
        const r = await fetch('/api/priere');
        const d = await r.json();
        priere = d;
        const texte = d.texte || '';
        const mots = texte.split(' ');
        const courte = mots.slice(0,10).join(' ') + (mots.length > 10 ? '...' : '');
        if (el) {
            el.innerHTML = d.titre
                ? `<strong style="font-size:12px;color:#d97706">Évangile du jour</strong><br>"${courte}"`
                : `"${courte}"`;
        }
    } catch {
        priere = { texte: 'Je puis tout par celui qui me fortifie.', ref: 'Philippiens 4:13' };
        if (el) el.textContent = '"Je puis tout par celui qui me fortifie..."';
    }
}
