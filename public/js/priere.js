// ===================== WIDGET PRIERE =====================

async function chargerPriere() {
    const el = document.getElementById('wc-priere');
    if (el) el.textContent = 'Chargement...';
    try {
        const r = await fetch(`/api/priere?dernier=${dernierIndex}`);
        const d = await r.json();
        dernierIndex = d.index; priere = d;
        const mots = d.texte.split(' ');
        const courte = mots.slice(0,10).join(' ')+(mots.length>10?'...':'');
        if (el) el.textContent = `"${courte}"`;
    } catch {
        priere = {texte:'Je puis tout par celui qui me fortifie.',ref:'Philippiens 4:13'};
        if (el) el.textContent = '"Je puis tout par celui qui me fortifie..."';
    }
}
