// ===================== WIDGET PRIERE =====================

let priere = null;

async function chargerPriere() {
    const el = document.getElementById('wc-priere');
    if (el) el.innerHTML = '<p style="color:#9ca3af;font-size:13px">Chargement...</p>';
    try {
        const r = await fetch('/api/priere');
        const d = await r.json();
        priere = d;

        if (el) {
            const extrait = (d.evangile || d.texte || '')
                .split('\n')
                .filter(l => l.trim().length > 20)
                .slice(0, 2)
                .join(' ')
                .substring(0, 120);

            el.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:10px;padding:10px 14px;border-left:4px solid #d97706;">
                        <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Évangile du jour</div>
                        ${d.titre ? `<div style="font-size:12px;font-weight:600;color:#78350f;margin-bottom:6px;">${d.titre}</div>` : ''}
                        <div style="font-size:12px;color:#444;font-style:italic;line-height:1.5;">"${extrait}..."</div>
                    </div>
                    ${d.lecture1 ? `
                    <div style="background:#f0f9ff;border-radius:8px;padding:8px 12px;border-left:3px solid #0369a1;">
                        <div style="font-size:10px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">1ère lecture</div>
                        <div style="font-size:11px;color:#555;font-style:italic;">"${d.lecture1.split('\n').filter(l=>l.trim().length>10)[0]?.substring(0,80) || ''}..."</div>
                    </div>` : ''}
                </div>`;
        }
    } catch {
        priere = { texte: 'Je puis tout par celui qui me fortifie.', ref: 'Philippiens 4:13' };
        if (el) el.innerHTML = `
            <div style="background:#fef3c7;border-radius:10px;padding:10px 14px;border-left:4px solid #d97706;">
                <div style="font-size:12px;color:#444;font-style:italic;">"Je puis tout par celui qui me fortifie..."</div>
                <div style="font-size:11px;color:#92400e;text-align:right;margin-top:4px;">Philippiens 4:13</div>
            </div>`;
    }
}
