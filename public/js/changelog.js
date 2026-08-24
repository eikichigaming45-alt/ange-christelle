// ============================================================
// public/js/changelog.js
// Chargement et affichage du changelog dans la modale générique
// ============================================================

async function ouvrirChangelog() {
    fermerUserMenu();
    try {
        const r = await fetch('/api/changelog');
        const d = await r.json();

        if (!d.success) {
            openModal('Changelog');
            document.getElementById('modal-body').innerHTML = `
                <p style="text-align:center;color:#9ca3af;font-size:14px">
                    Changelog indisponible.
                </p>`;
            return;
        }

        // Conversion Markdown simple → HTML (## titres + tirets)
        const html = d.contenu
            .split('\n')
            .map(line => {
                if (line.startsWith('## ')) {
                    return `<h3 style="font-size:15px;font-weight:700;color:#7c3aed;
                                      margin:20px 0 8px;padding-bottom:6px;
                                      border-bottom:2px solid #ede9fe">
                                ${line.replace('## ', '')}
                            </h3>`;
                }
                if (line.startsWith('- ')) {
                    return `<div style="display:flex;gap:8px;align-items:flex-start;
                                       margin-bottom:6px;font-size:13px;color:#374151">
                                <span style="color:#7c3aed;margin-top:2px">•</span>
                                <span>${line.replace('- ', '')}</span>
                            </div>`;
                }
                if (line.trim() === '') return '<div style="margin-bottom:4px"></div>';
                return `<p style="font-size:13px;color:#374151;margin:4px 0">${line}</p>`;
            })
            .join('');

        openModal('📋 Changelog');
        document.getElementById('modal-body').innerHTML = `
            <div style="max-height:60vh;overflow-y:auto;padding-right:4px">
                ${html}
            </div>`;

    } catch {
        openModal('Changelog');
        document.getElementById('modal-body').innerHTML = `
            <p style="text-align:center;color:#ef4444;font-size:14px">
                Erreur réseau.
            </p>`;
    }
}
