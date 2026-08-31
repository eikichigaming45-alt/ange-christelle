// ============================================================
// public/js/tchat.js
// Tchat MoaDja — bulle flottante · bottom sheet mobile
// tiroir desktop · Socket.io temps réel · REST fallback
// ============================================================

(function () {
    'use strict';

    // ── Constantes ────────────────────────────────────────────
    const LIMITE_PAR_PAGE = 40;

    // ── Conversion raccourcis → emojis ────────────────────────
    function _convertirEmojis(texte) {
        const MAP = [
            ['>:-)',  '😈'], ['>:)',   '😈'],
            [":'(",   '😭'],
            [':-)',   '😊'], [':)',    '😊'],
            [':-(', '😢'],   [':(',   '😢'],
            [';-)',   '😉'], [';)',    '😉'],
            [':-D',  '😄'],  [':D',   '😄'],
            [':-P',  '😛'],  [':P',   '😛'],
            [':-p',  '😛'],  [':p',   '😛'],
            [':-O',  '😮'],  [':O',   '😮'],
            [':-o',  '😮'],  [':o',   '😮'],
            ['<3',   '❤️'],  ['^^',   '😊'],
            [':joy:',    '😂'], [':ok:',     '👍'],
            [':fire:',   '🔥'], [':heart:',  '❤️'],
            [':smile:',  '😊'], [':laugh:',  '😂'],
            [':wink:',   '😉'], [':cry:',    '😢'],
            [':sad:',    '😢'], [':angry:',  '😠'],
            [':love:',   '😍'], [':kiss:',   '😘'],
            [':cool:',   '😎'], [':think:',  '🤔'],
            [':wow:',    '😮'], [':clap:',   '👏'],
            [':star:',   '⭐'], [':sun:',    '☀️'],
            [':moon:',   '🌙'], [':wave:',   '👋'],
            [':pray:',   '🙏'], [':muscle:', '💪'],
            [':check:',  '✅'], [':x:',      '❌'],
            [':tada:',   '🎉'], [':cake:',   '🎂'],
            [':gift:',   '🎁'], [':rose:',   '🌹'],
            [':100:',    '💯'],
        ];
        let t = texte;
        for (const [s, e] of MAP) t = t.split(s).join(e);
        return t;
    }

    // ── État interne ──────────────────────────────────────────
    let _socket             = null;
    let _interlocuteurActif = null;
    let _plusAncienMsgId    = null;
    let _chargementEnCours  = false;
    let _ouvert             = false;
    let _vueActive          = 'liste';
    let _replyTo            = null; // { id, content, sender_nom }
    let _menuActif          = null; // element menu contextuel ouvert

    // ── Utilitaires ───────────────────────────────────────────
    function _token() {
        try { return JSON.parse(localStorage.getItem('moadja_user'))?.token || ''; }
        catch { return ''; }
    }

    function _userId() {
        try { return JSON.parse(localStorage.getItem('moadja_user'))?.userId || null; }
        catch { return null; }
    }

    function _authHeaders() {
        return {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${_token()}`
        };
    }

    function _roomName(u1, u2) {
        return `conv_${Math.min(u1, u2)}_${Math.max(u1, u2)}`;
    }

    function _initiale(prenom, username) {
        return (prenom || username || '?').charAt(0).toUpperCase();
    }

    function _formatHeure(dateStr) {
        return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function _formatDateSep(dateStr) {
        const d    = new Date(dateStr);
        const auj  = new Date();
        const hier = new Date(auj); hier.setDate(hier.getDate() - 1);
        if (d.toDateString() === auj.toDateString())  return "Aujourd'hui";
        if (d.toDateString() === hier.toDateString()) return 'Hier';
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    }

    function _avatarHTML(photo, prenom, username, taille = 42) {
        if (photo) {
            return `<img src="${photo}" alt="${prenom || username}"
                style="width:${taille}px;height:${taille}px;border-radius:50%;object-fit:cover;position:absolute;top:2px;left:2px;">`;
        }
        return `<div class="tchat-avatar-initiale"
            style="width:${taille-4}px;height:${taille-4}px;font-size:${Math.round(taille*.38)}px;">
            ${_initiale(prenom, username)}</div>`;
    }

    function _echapper(str) {
        return (str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _fermerMenuContextuel() {
        if (_menuActif) { _menuActif.remove(); _menuActif = null; }
    }

    // ── Construction DOM initiale ─────────────────────────────
    function _construireDom() {
        if (document.getElementById('tchat-bulle')) return;

        const bulle = document.createElement('button');
        bulle.id    = 'tchat-bulle';
        bulle.title = 'Tchat';
        bulle.setAttribute('aria-label', 'Ouvrir le tchat');
        bulle.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/>
            </svg>
            <span id="tchat-bulle-badge"></span>`;
        bulle.addEventListener('click', _toggleTchat);

        const overlay = document.createElement('div');
        overlay.id = 'tchat-overlay';
        overlay.addEventListener('click', _fermerTchat);

        const sheet = document.createElement('div');
        sheet.id = 'tchat-sheet';
        sheet.innerHTML = `
            <div id="tchat-sheet-handle"></div>
            <div id="tchat-header">
                <span id="tchat-header-titre">Tchat</span>
                <div id="tchat-header-actions">
                    <button id="tchat-btn-fermer" aria-label="Fermer">✕</button>
                </div>
            </div>
            <div id="tchat-vue-liste">
                <div id="tchat-liste-scroll"></div>
                <button id="tchat-btn-nouvelle-conv">+ Nouvelle conversation</button>
            </div>
            <div id="tchat-vue-conv">
                <div id="tchat-conv-header">
                    <button id="tchat-conv-back" aria-label="Retour">‹</button>
                    <div id="tchat-conv-avatar-wrap">
                        <span id="tchat-conv-avatar-img"></span>
                    </div>
                    <div id="tchat-conv-nom-dest">
                        <strong id="tchat-conv-nom-label"></strong>
                        <span id="tchat-conv-statut"></span>
                    </div>
                </div>
                <div id="tchat-messages-scroll">
                    <button id="tchat-btn-plus-anciens" style="display:none">
                        Charger les messages précédents
                    </button>
                </div>
                <div id="tchat-reply-preview" style="display:none">
                    <div id="tchat-reply-texte"></div>
                    <button id="tchat-reply-annuler" aria-label="Annuler réponse">✕</button>
                </div>
                <div id="tchat-saisie-wrap">
                    <textarea id="tchat-input"
                              placeholder="Écrire un message…"
                              rows="1"
                              maxlength="2000"></textarea>
                    <button id="tchat-btn-envoyer" disabled aria-label="Envoyer">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(bulle);
        document.body.appendChild(overlay);
        document.body.appendChild(sheet);

        document.getElementById('tchat-btn-fermer').addEventListener('click', _fermerTchat);
        document.getElementById('tchat-conv-back').addEventListener('click', _afficherVueListe);
        document.getElementById('tchat-btn-nouvelle-conv').addEventListener('click', _ouvrirSelectUser);
        document.getElementById('tchat-btn-plus-anciens').addEventListener('click', _chargerPlusAnciens);
        document.getElementById('tchat-reply-annuler').addEventListener('click', _annulerReply);

        const input  = document.getElementById('tchat-input');
        const btnEnv = document.getElementById('tchat-btn-envoyer');

        input.addEventListener('input', () => {
            btnEnv.disabled = !input.value.trim();
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!btnEnv.disabled) _envoyerMessage();
            }
        });

        btnEnv.addEventListener('click', _envoyerMessage);

        // Fermer menu contextuel au clic ailleurs
        document.addEventListener('click', _fermerMenuContextuel);
    }

    // ── Reply preview ─────────────────────────────────────────
    function _activerReply(msg) {
        _replyTo = msg;
        const preview = document.getElementById('tchat-reply-preview');
        const texte   = document.getElementById('tchat-reply-texte');
        const nom     = msg.reply_sender_prenom || msg.sender_prenom || msg.sender_username || 'Message';
        texte.innerHTML = `<strong>${_echapper(nom)}</strong> ${_echapper((msg.content || '').substring(0, 80))}`;
        preview.style.display = 'flex';
        document.getElementById('tchat-input').focus();
    }

    function _annulerReply() {
        _replyTo = null;
        document.getElementById('tchat-reply-preview').style.display = 'none';
        document.getElementById('tchat-reply-texte').innerHTML = '';
    }

    // ── Menu contextuel message ───────────────────────────────
    function _ouvrirMenuContextuel(e, wrap, msg, moi) {
        e.preventDefault();
        e.stopPropagation();
        _fermerMenuContextuel();

        const sortant = msg.sender_id === moi;
        const menu    = document.createElement('div');
        menu.className = 'tchat-menu-contextuel';

        const items = [];
        // Répondre — tous les messages
        items.push({ label: '↩ Répondre', action: () => _activerReply(msg) });
        // Modifier — uniquement ses propres messages
        if (sortant) {
            items.push({ label: '✏️ Modifier', action: () => _editerMessage(wrap, msg) });
        }
        // Supprimer — tous les messages visibles (pour soi)
        items.push({ label: '🗑️ Supprimer', danger: true, action: () => _supprimerMessage(wrap, msg.id) });

        menu.innerHTML = items.map((item, i) =>
            `<button class="tchat-menu-item${item.danger ? ' danger' : ''}" data-idx="${i}">
                ${item.label}
            </button>`
        ).join('');

        menu.querySelectorAll('.tchat-menu-item').forEach((btn, i) => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                _fermerMenuContextuel();
                items[i].action();
            });
        });

        // Positionner
        const rect = wrap.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.zIndex   = '9999';
        menu.style.top      = (rect.bottom + 4) + 'px';
        menu.style.left     = Math.min(rect.left, window.innerWidth - 180) + 'px';

        document.body.appendChild(menu);
        _menuActif = menu;
    }

    // ── Édition inline ────────────────────────────────────────
    function _editerMessage(wrap, msg) {
        const bulle = wrap.querySelector('.tchat-msg-bulle');
        if (!bulle) return;

        const contenuOriginal = msg.content;
        const input = document.createElement('textarea');
        input.className = 'tchat-edit-input';
        input.value     = contenuOriginal;
        input.rows      = 2;
        input.style.cssText = `
            width:100%;padding:8px 10px;border:1.5px solid #a78bfa;border-radius:12px;
            font-size:14px;font-family:inherit;resize:none;outline:none;
            background:#fff;color:#1f2937;box-sizing:border-box;margin-top:4px;`;

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;margin-top:6px;justify-content:flex-end;';
        actions.innerHTML = `
            <button class="tchat-edit-annuler" style="
                background:none;border:1px solid #e5e7eb;border-radius:8px;
                padding:4px 12px;font-size:12px;cursor:pointer;color:#6b7280;">
                Annuler
            </button>
            <button class="tchat-edit-valider" style="
                background:linear-gradient(135deg,#f472b6,#a78bfa);border:none;
                border-radius:8px;padding:4px 12px;font-size:12px;
                cursor:pointer;color:#fff;font-weight:600;">
                Sauvegarder
            </button>`;

        bulle.replaceWith(input);
        wrap.appendChild(actions);

        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        actions.querySelector('.tchat-edit-annuler').addEventListener('click', () => {
            input.replaceWith(bulle);
            actions.remove();
        });

        actions.querySelector('.tchat-edit-valider').addEventListener('click', async () => {
            const nouveau = input.value.trim();
            if (!nouveau || nouveau === contenuOriginal) {
                input.replaceWith(bulle);
                actions.remove();
                return;
            }
            try {
                const r = await fetch(`/api/tchat/messages/${msg.id}`, {
                    method : 'PATCH',
                    headers: _authHeaders(),
                    body   : JSON.stringify({ content: nouveau })
                });
                const d = await r.json();
                if (d.success) {
                    msg.content  = nouveau;
                    msg.edited_at = d.message.edited_at;
                    bulle.innerHTML = _echapper(_convertirEmojis(nouveau));
                    input.replaceWith(bulle);
                    actions.remove();
                    // Ajouter mention "modifié"
                    let modifTag = wrap.querySelector('.tchat-msg-modifie');
                    if (!modifTag) {
                        modifTag = document.createElement('span');
                        modifTag.className = 'tchat-msg-modifie';
                        modifTag.textContent = 'modifié';
                        wrap.querySelector('.tchat-msg-meta').prepend(modifTag);
                    }
                } else {
                    input.replaceWith(bulle);
                    actions.remove();
                }
            } catch {
                input.replaceWith(bulle);
                actions.remove();
            }
        });
    }

    // ── Supprimer message ─────────────────────────────────────
    async function _supprimerMessage(wrap, msgId) {
        try {
            const r = await fetch(`/api/tchat/messages/${msgId}`, {
                method : 'DELETE',
                headers: _authHeaders()
            });
            const d = await r.json();
            if (d.success) {
                wrap.classList.add('tchat-msg-supprime');
                const bulle = wrap.querySelector('.tchat-msg-bulle');
                if (bulle) {
                    bulle.innerHTML  = '<em>Message supprimé</em>';
                    bulle.style.color = '#d1d5db';
                    bulle.style.fontStyle = 'italic';
                }
                // Retirer les actions ✓✓ et modifié
                wrap.querySelectorAll('.tchat-msg-lu, .tchat-msg-modifie').forEach(el => el.remove());
            }
        } catch (err) {
            console.error('[TCHAT] supprimerMessage :', err.message);
        }
    }

    // ── Supprimer conversation ────────────────────────────────
    async function _supprimerConversation(interlocuteurId) {
        try {
            const r = await fetch(`/api/tchat/conversations/${interlocuteurId}`, {
                method : 'DELETE',
                headers: _authHeaders()
            });
            const d = await r.json();
            if (d.success) _chargerConversations();
        } catch (err) {
            console.error('[TCHAT] supprimerConversation :', err.message);
        }
    }

    // ── Socket.io ─────────────────────────────────────────────
    function _initSocket() {
        if (_socket) return;
        if (typeof io === 'undefined') return;

        _socket = io({ auth: { token: _token() } });

        _socket.on('connect', () => console.log('[TCHAT] Socket connecté'));

        _socket.on('tchat:message', (msg) => {
            const moi = _userId();
            if (
                _interlocuteurActif &&
                (
                    (msg.sender_id === moi && msg.receiver_id === _interlocuteurActif.id) ||
                    (msg.sender_id === _interlocuteurActif.id && msg.receiver_id === moi)
                )
            ) {
                _appendMessage(msg);
                _scrollBasMessages();
                if (msg.sender_id !== moi) _marquerLu(_interlocuteurActif.id);
            }
            _chargerConversations();
            _rafraichirBadgeBulle();
        });

        _socket.on('tchat:lu', ({ par }) => {
            if (_interlocuteurActif && par === _interlocuteurActif.id) {
                document.querySelectorAll('.tchat-msg.sortant .tchat-msg-lu').forEach(el => {
                    el.textContent = '✓✓';
                    el.classList.remove('envoye');
                });
            }
        });

        _socket.on('tchat:modifie', (msg) => {
            const wrap = document.querySelector(`[data-msg-id="${msg.id}"]`);
            if (!wrap) return;
            const bulle = wrap.querySelector('.tchat-msg-bulle');
            if (bulle) bulle.innerHTML = _echapper(_convertirEmojis(msg.content));
            let modifTag = wrap.querySelector('.tchat-msg-modifie');
            if (!modifTag) {
                modifTag = document.createElement('span');
                modifTag.className   = 'tchat-msg-modifie';
                modifTag.textContent = 'modifié';
                wrap.querySelector('.tchat-msg-meta')?.prepend(modifTag);
            }
        });

        _socket.on('tchat:supprime', ({ id, par }) => {
            const moi  = _userId();
            if (par === moi) return; // déjà géré côté émetteur
            const wrap = document.querySelector(`[data-msg-id="${id}"]`);
            if (!wrap) return;
            const bulle = wrap.querySelector('.tchat-msg-bulle');
            if (bulle) {
                bulle.innerHTML       = '<em>Message supprimé</em>';
                bulle.style.color     = '#d1d5db';
                bulle.style.fontStyle = 'italic';
            }
            wrap.querySelectorAll('.tchat-msg-lu, .tchat-msg-modifie').forEach(el => el.remove());
        });

        _socket.on('disconnect', () => console.log('[TCHAT] Socket déconnecté'));
    }

    function _rejoindreRoom(userId, interlocuteurId) {
        if (!_socket) return;
        _socket.emit('tchat:rejoindre', { room: _roomName(userId, interlocuteurId) });
    }

    function _quitterRoom(userId, interlocuteurId) {
        if (!_socket) return;
        _socket.emit('tchat:quitter', { room: _roomName(userId, interlocuteurId) });
    }

    // ── Ouvrir / fermer ───────────────────────────────────────
    function _toggleTchat() { _ouvert ? _fermerTchat() : _ouvrirTchat(); }

    function _ouvrirTchat() {
        _ouvert = true;
        document.getElementById('tchat-sheet').classList.add('ouvert');
        document.getElementById('tchat-overlay').classList.add('visible');
        _afficherVueListe();
        _chargerConversations();
        _initSocket();
    }

    function _fermerTchat() {
        _ouvert = false;
        document.getElementById('tchat-sheet').classList.remove('ouvert');
        document.getElementById('tchat-overlay').classList.remove('visible');
        if (_interlocuteurActif) {
            _quitterRoom(_userId(), _interlocuteurActif.id);
            _interlocuteurActif = null;
        }
        _annulerReply();
    }

    // ── Navigation vues ───────────────────────────────────────
    function _afficherVueListe() {
        _vueActive = 'liste';
        document.getElementById('tchat-vue-liste').style.display = 'flex';
        document.getElementById('tchat-vue-conv').classList.remove('active');
        document.getElementById('tchat-header-titre').textContent = 'Tchat';
        if (_interlocuteurActif) {
            _quitterRoom(_userId(), _interlocuteurActif.id);
            _interlocuteurActif = null;
        }
        _annulerReply();
        _chargerConversations();
    }

    function _afficherVueConv(interlocuteur) {
        _vueActive          = 'conv';
        _interlocuteurActif = interlocuteur;
        _plusAncienMsgId    = null;

        document.getElementById('tchat-vue-liste').style.display = 'none';
        document.getElementById('tchat-vue-conv').classList.add('active');
        document.getElementById('tchat-header-titre').textContent = '';
        document.getElementById('tchat-conv-nom-label').textContent =
            interlocuteur.prenom || interlocuteur.username;
        document.getElementById('tchat-conv-avatar-wrap')
            .querySelector('#tchat-conv-avatar-img').innerHTML =
            _avatarHTML(interlocuteur.photo, interlocuteur.prenom, interlocuteur.username, 36);
        document.getElementById('tchat-conv-statut').textContent = '';

        const scroll = document.getElementById('tchat-messages-scroll');
        scroll.innerHTML = `
            <button id="tchat-btn-plus-anciens" style="display:none">
                Charger les messages précédents
            </button>`;
        document.getElementById('tchat-btn-plus-anciens')
            .addEventListener('click', _chargerPlusAnciens);

        _annulerReply();
        _rejoindreRoom(_userId(), interlocuteur.id);
        _chargerMessages();
        _marquerLu(interlocuteur.id);
    }

    // ── Conversations ─────────────────────────────────────────
    async function _chargerConversations() {
        const liste = document.getElementById('tchat-liste-scroll');
        if (!liste) return;
        try {
            const r = await fetch('/api/tchat/conversations', { headers: _authHeaders() });
            const d = await r.json();
            if (!d.success) return;

            if (!d.conversations.length) {
                liste.innerHTML = `
                    <div class="tchat-vide">
                        <div class="tchat-vide-icone">💬</div>
                        <div class="tchat-vide-texte">Aucune conversation.<br>Commence à écrire !</div>
                    </div>`;
                return;
            }

            liste.innerHTML = d.conversations.map(c => {
                const moi    = _userId();
                const nom    = c.prenom || c.username;
                const apercu = c.dernier_message
                    ? (c.dernier_sender_id === moi ? `Vous : ${c.dernier_message}` : c.dernier_message)
                    : 'Aucun message';
                const heure  = c.dernier_message_at ? _formatHeure(c.dernier_message_at) : '';
                const nonLu  = c.non_lus > 0;
                return `
                    <div class="tchat-conv-item"
                         data-id="${c.interlocuteur_id}"
                         data-username="${c.username}"
                         data-prenom="${c.prenom || ''}"
                         data-photo="${c.photo || ''}">
                        <div class="tchat-conv-avatar">
                            ${_avatarHTML(c.photo, c.prenom, c.username, 42)}
                        </div>
                        <div class="tchat-conv-infos">
                            <div class="tchat-conv-nom">${nom}</div>
                            <div class="tchat-conv-apercu${nonLu ? ' non-lu' : ''}">
                                ${_echapper(apercu.substring(0, 60))}
                            </div>
                        </div>
                        <div class="tchat-conv-meta">
                            <span class="tchat-conv-heure">${heure}</span>
                            ${nonLu ? `<span class="tchat-conv-badge">${c.non_lus}</span>` : ''}
                        </div>
                        <button class="tchat-conv-suppr" data-id="${c.interlocuteur_id}"
                                title="Supprimer la conversation"
                                style="background:none;border:none;color:#d1d5db;font-size:16px;
                                       cursor:pointer;padding:4px 6px;border-radius:8px;
                                       margin-left:4px;flex-shrink:0;line-height:1;">🗑️</button>
                    </div>`;
            }).join('');

            liste.querySelectorAll('.tchat-conv-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.tchat-conv-suppr')) return;
                    _afficherVueConv({
                        id       : parseInt(el.dataset.id, 10),
                        username : el.dataset.username,
                        prenom   : el.dataset.prenom || null,
                        photo    : el.dataset.photo  || null
                    });
                });
            });

            liste.querySelectorAll('.tchat-conv-suppr').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _supprimerConversation(parseInt(btn.dataset.id, 10));
                });
            });
        } catch (err) {
            console.error('[TCHAT] chargerConversations :', err.message);
        }
    }

    // ── Messages ──────────────────────────────────────────────
    async function _chargerMessages(avant = null) {
        if (_chargementEnCours || !_interlocuteurActif) return;
        _chargementEnCours = true;

        const scroll  = document.getElementById('tchat-messages-scroll');
        const btnPlus = document.getElementById('tchat-btn-plus-anciens');

        try {
            let url = `/api/tchat/messages/${_interlocuteurActif.id}`;
            if (avant) url += `?avant=${avant}`;

                        const r = await fetch(url, { headers: _authHeaders() });
            const d = await r.json();
            if (!d.success) return;

            const msgs = d.messages;

            if (!msgs.length && !avant) {
                scroll.innerHTML = `
                    <button id="tchat-btn-plus-anciens" style="display:none">
                        Charger les messages précédents
                    </button>
                    <div class="tchat-vide">
                        <div class="tchat-vide-icone">👋</div>
                        <div class="tchat-vide-texte">Dis bonjour !</div>
                    </div>`;
                document.getElementById('tchat-btn-plus-anciens')
                    .addEventListener('click', _chargerPlusAnciens);
                return;
            }

            if (msgs.length === LIMITE_PAR_PAGE) {
                _plusAncienMsgId = msgs[0].id;
                if (btnPlus) btnPlus.style.display = 'flex';
            } else {
                if (btnPlus) btnPlus.style.display = 'none';
            }

            if (avant) {
                const ancreId  = scroll.querySelector('.tchat-msg')?.dataset.msgId;
                const fragment = _construireFragment(msgs);
                const ancre    = ancreId
                    ? scroll.querySelector(`[data-msg-id="${ancreId}"]`)
                    : null;
                if (ancre) scroll.insertBefore(fragment, ancre);
                else       scroll.appendChild(fragment);
            } else {
                const vide = scroll.querySelector('.tchat-vide');
                if (vide) vide.remove();
                scroll.appendChild(_construireFragment(msgs));
                _scrollBasMessages();
            }
        } catch (err) {
            console.error('[TCHAT] chargerMessages :', err.message);
        } finally {
            _chargementEnCours = false;
        }
    }

    function _chargerPlusAnciens() {
        if (_plusAncienMsgId) _chargerMessages(_plusAncienMsgId);
    }

    function _construireFragment(msgs) {
        const fragment = document.createDocumentFragment();
        const moi      = _userId();
        let   dernDate = null;

        msgs.forEach(msg => {
            const dateMsg = new Date(msg.created_at).toDateString();
            if (dateMsg !== dernDate) {
                dernDate = dateMsg;
                const sep = document.createElement('div');
                sep.className   = 'tchat-date-sep';
                sep.textContent = _formatDateSep(msg.created_at);
                fragment.appendChild(sep);
            }
            fragment.appendChild(_creerBulleDom(msg, moi));
        });

        return fragment;
    }

    function _creerBulleDom(msg, moi) {
        const sortant  = msg.sender_id === moi;
        const supprime = Array.isArray(msg.deleted_for) && msg.deleted_for.includes(moi);
        const wrap     = document.createElement('div');
        wrap.className     = `tchat-msg ${sortant ? 'sortant' : 'entrant'}`;
        wrap.dataset.msgId = msg.id;

        const luHTML = sortant
            ? `<span class="tchat-msg-lu ${msg.seen ? '' : 'envoye'}">${msg.seen ? '✓✓' : '✓'}</span>`
            : '';

        const modifieHTML = msg.edited_at
            ? `<span class="tchat-msg-modifie">modifié</span>`
            : '';

        // Citation (reply)
        let replyHTML = '';
        if (msg.reply_to_id && msg.reply_content) {
            const replyNom = msg.reply_sender_prenom || msg.reply_sender_username || '';
            replyHTML = `
                <div class="tchat-reply-cite">
                    <span class="tchat-reply-cite-nom">${_echapper(replyNom)}</span>
                    <span class="tchat-reply-cite-texte">${_echapper((msg.reply_content || '').substring(0, 80))}</span>
                </div>`;
        }

        const contenu = supprime
            ? '<em style="color:#d1d5db">Message supprimé</em>'
            : _echapper(_convertirEmojis(msg.content));

        wrap.innerHTML = `
            <div class="tchat-msg-bulle">
                ${replyHTML}
                ${contenu}
            </div>
            <div class="tchat-msg-meta">
                ${modifieHTML}
                <span class="tchat-msg-heure">${_formatHeure(msg.created_at)}</span>
                ${luHTML}
            </div>`;

        // Menu contextuel — long press mobile · clic droit desktop · hover button
        if (!supprime) {
            let longPressTimer = null;

            wrap.addEventListener('contextmenu', (e) => {
                _ouvrirMenuContextuel(e, wrap, msg, moi);
            });

            wrap.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => {
                    const fakeE = { preventDefault: () => {}, stopPropagation: () => {} };
                    _ouvrirMenuContextuel(fakeE, wrap, msg, moi);
                }, 500);
            }, { passive: true });

            wrap.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });

            wrap.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
        }

        return wrap;
    }

    function _appendMessage(msg) {
        const scroll = document.getElementById('tchat-messages-scroll');
        if (!scroll) return;

        const vide = scroll.querySelector('.tchat-vide');
        if (vide) vide.remove();

        const moi       = _userId();
        const dernBulle = scroll.querySelectorAll('.tchat-msg');
        if (dernBulle.length) {
            const dernDate = new Date(parseInt(dernBulle[dernBulle.length - 1].dataset.msgId || 0));
            const nouvDate = new Date(msg.created_at);
            if (dernDate.toDateString() !== nouvDate.toDateString()) {
                const sep = document.createElement('div');
                sep.className   = 'tchat-date-sep';
                sep.textContent = _formatDateSep(msg.created_at);
                scroll.appendChild(sep);
            }
        }

        scroll.appendChild(_creerBulleDom(msg, moi));
    }

    function _scrollBasMessages() {
        const scroll = document.getElementById('tchat-messages-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }

    // ── Envoyer ───────────────────────────────────────────────
    async function _envoyerMessage() {
        const input  = document.getElementById('tchat-input');
        const btnEnv = document.getElementById('tchat-btn-envoyer');
        const texte  = input.value.trim();
        if (!texte || !_interlocuteurActif) return;

        input.value        = '';
        input.style.height = 'auto';
        btnEnv.disabled    = true;

        try {
            const body = {
                receiver_id: _interlocuteurActif.id,
                content    : texte
            };
            if (_replyTo) body.reply_to_id = _replyTo.id;

            const r = await fetch('/api/tchat/messages', {
                method : 'POST',
                headers: _authHeaders(),
                body   : JSON.stringify(body)
            });
            const d = await r.json();
            if (!d.success) {
                input.value     = texte;
                btnEnv.disabled = false;
                return;
            }
            _annulerReply();
            if (!_socket?.connected) {
                _appendMessage(d.message);
                _scrollBasMessages();
            }
            _rafraichirBadgeBulle();
        } catch (err) {
            console.error('[TCHAT] envoyerMessage :', err.message);
            input.value     = texte;
            btnEnv.disabled = false;
        }
    }

    // ── Marquer lu ────────────────────────────────────────────
    async function _marquerLu(interlocuteurId) {
        try {
            await fetch('/api/tchat/messages/lus', {
                method : 'POST',
                headers: _authHeaders(),
                body   : JSON.stringify({ interlocuteur_id: interlocuteurId })
            });
            _rafraichirBadgeBulle();
        } catch (err) {
            console.error('[TCHAT] marquerLu :', err.message);
        }
    }

    // ── Sélecteur utilisateur (nouvelle conv) ─────────────────
    async function _ouvrirSelectUser() {
        try {
            const r = await fetch('/api/tchat/users', { headers: _authHeaders() });
            const d = await r.json();
            if (!d.success) return;

            const liste = document.getElementById('tchat-liste-scroll');
            liste.innerHTML = `
                <div style="padding:14px 18px 8px">
                    <button id="tchat-retour-select"
                            style="background:none;border:none;color:#a78bfa;font-size:13px;
                                   font-weight:600;cursor:pointer;padding:0;">
                        ‹ Retour
                    </button>
                    <div style="font-size:15px;font-weight:700;color:#1f2937;margin-top:8px;">
                        Nouvelle conversation
                    </div>
                </div>
                ${d.users.map(u => `
                    <div class="tchat-conv-item"
                         data-id="${u.id}"
                         data-username="${u.username}"
                         data-prenom="${u.prenom || ''}"
                         data-photo="${u.photo || ''}">
                        <div class="tchat-conv-avatar">
                            ${_avatarHTML(u.photo, u.prenom, u.username, 42)}
                        </div>
                        <div class="tchat-conv-infos">
                            <div class="tchat-conv-nom">${u.prenom || u.username}</div>
                            <div class="tchat-conv-apercu">@${u.username}</div>
                        </div>
                    </div>`).join('')}
            `;

            document.getElementById('tchat-retour-select')
                .addEventListener('click', _afficherVueListe);

            liste.querySelectorAll('.tchat-conv-item').forEach(el => {
                el.addEventListener('click', () => {
                    _afficherVueConv({
                        id       : parseInt(el.dataset.id, 10),
                        username : el.dataset.username,
                        prenom   : el.dataset.prenom || null,
                        photo    : el.dataset.photo  || null
                    });
                });
            });
        } catch (err) {
            console.error('[TCHAT] ouvrirSelectUser :', err.message);
        }
    }

    // ── Badge bulle + topbar ──────────────────────────────────
    async function _rafraichirBadgeBulle() {
        try {
            const r = await fetch('/api/tchat/non-lus', { headers: _authHeaders() });
            const d = await r.json();
            if (!d.success) return;

            const badge = document.getElementById('tchat-bulle-badge');
            if (badge) {
                if (d.total > 0) {
                    badge.textContent = d.total > 99 ? '99+' : d.total;
                    badge.classList.add('visible');
                } else {
                    badge.classList.remove('visible');
                }
            }

            const badgeTopbar = document.getElementById('tchat-topbar-badge');
            if (badgeTopbar) {
                if (d.total > 0) {
                    badgeTopbar.textContent   = d.total > 99 ? '99+' : d.total;
                    badgeTopbar.style.display = 'flex';
                } else {
                    badgeTopbar.style.display = 'none';
                }
            }
        } catch { /* silencieux */ }
    }

    // ── API publique ──────────────────────────────────────────
    window.Tchat = {
        ouvrirConversation(interlocuteur) {
            if (!_ouvert) _ouvrirTchat();
            _afficherVueConv(interlocuteur);
        },
        toggle  : _toggleTchat,
        init() {
            _construireDom();
            _rafraichirBadgeBulle();
            setInterval(_rafraichirBadgeBulle, 30000);
        },
        rafraichirBadge: _rafraichirBadgeBulle
    };

})();
