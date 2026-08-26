# CHANGELOG — MyDaily

---

## v1.16 — 26-08-2026
- fix : conseil cycle IA tronqué sur mobile — seuil porté de 120 à 220 caractères
- fix : ajout `word-break:break-word;overflow-wrap:anywhere` sur le bloc conseil (social.js)
- sw.js : CACHE_NAME bumped → `mydaily-cache-v1.16`

---

## v1.15 — 26-08-2026
- fix : commentaires imbriqués — colonne `parent_id` + CASCADE DELETE (post_comments)
- fix : `parent_id` string vs number → cast `Number(parent_id)` côté client (feed.js)
- fix : input réponse prérempli avec texte parent → `inputEl.value = ''` avant focus (feed.js)
- fix : crash mentions vides → `CASE WHEN array_length > 0` (routes/feed.js)
- sw.js : CACHE_NAME bumped → `mydaily-cache-v1.15`

---

## v1.13 — 25-08-2026
- fix : Push muet — `ON CONFLICT` invalide PostgreSQL → SELECT + UPDATE/INSERT explicite (routes/push.js)
- fix : `sender_id` NULL dans notifications coucou/partage → ajout sender_id + envoyerPush() (routes/social.js)
- fix : regex `resoudreMentions` trop gourmande + safeguard mentions null (routes/feed.js)
- fix : `@tag` brut non cliquable → garde client + séparateur double espace (public/js/feed.js)
- fix : décalage +1 jour la nuit → `_aujourdHuiLocal()` minuit local (public/js/cycle.js)
- fix : endpoint FCM invalidé à chaque login → suppression `unsubscribe()` forcé (public/js/push.js)
- sw.js : CACHE_NAME bumped → `mydaily-cache-v1.13`

---

## v1.08 — 24-08-2026
- MODULE @TAG : suggestions utilisateurs temps réel à la saisie de `@` (posts + commentaires + édition)
- feed.js : `initMentions()` — dropdown clavier/souris, insertion `@Prénom NOM`, debounce 200ms
- feed.js : `renderContenuAvecMentions()` — rendu des mentions en `<span class="mention-tag">` cliquables
- feed.js : délégation clic `.mention-tag` → résolution user via `/api/feed/users` → `ouvrirProfilPublic()`
- feed.js : `initMentions()` branché sur champ nouveau post, édition post, commentaire, édition commentaire
- feed.css : `.mention-tag` — chip violet cliquable avec hover
- feed.css : `.mention-dropdown` / `.mention-item` — liste déroulante positionnée (au-dessus champ, en dessous modale)
- sw.js : CACHE_NAME bumped → `mydaily-cache-v1.07`

---

## v1.06 — 25-08-2026
- MODULE CLOCHE : panel notifications + badge rouge + onglets Tout/Non lu + sections Aujourd'hui/Plus tôt + polling badge 60s
- feed.js : notifs cloche + push pour like / commentaire / follow
- social.js : GET /notifications — prenom/nom du sender + limite 10
- planning.js : purge anciens enregistrements déplacée au démarrage serveur (hors GET)
- push.js : correction rappel_avant → rappel_avant_shift (bug critique) + envoi multi-appareils
- pool.js : migrations planning (categorie, libelle_personnalise, date_debut, date_fin, rappel_avant_shift) + users.created_at
- MODULE CHANGELOG : route GET /api/changelog + modale + bouton menu activé
- .gitignore : ajout .env et uploads/
- package.json : engines node 24.x
- auteur commentaire cliquable profil public

---

## v1.00 — 24-08-2026
- Version stable initiale
- Infrastructure : Express 5.2 / Node 24.14.1 / Supabase / Groq / PWA
- 22 tables Supabase actives
- Modules : Profil, Feed, Planning, Tâches, Rendez-vous, Anniversaires, Cycle, Islam, Prières, Astrologie, Social, Push, Admin
- PWA : Service Worker + cache + notifications push
- Auth : JWT + WebAuthn
