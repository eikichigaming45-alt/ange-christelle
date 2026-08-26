# Changelog MyDaily

## v1.28 — 26-08-2026
### Nouveau
- MODULE SANTÉ : widget dédié avec calculs locaux IMC, BMR (Mifflin-St Jeor), TDEE, kcal objectif, macros (protéines / glucides / lipides)
- Plan nutritionnel & fitness quotidien généré via Groq (openai/gpt-oss-20b)
- Cache serveur Supabase (sante_plan_cache + sante_plan_date) — 1 appel Groq/jour max, sync multi-appareils
- Widget Santé déplacé dans l'onglet Bien-être (bienetre)
- Plan replié par défaut au chargement, même si déjà généré — bouton toggle "Voir le plan du jour"
- Profil modal : onglet Santé séparé des calculs (champs saisie uniquement), calculs affichés uniquement dans le widget

### Base de données
- profiles : ajout colonnes allergies text[], aliments_exclus text[]
- profiles : ajout colonnes sante_plan_cache jsonb, sante_plan_date date
- Suppression table webauthn_credentials (inutilisée)

### Backend
- Nouveau fichier routes/sante.js : POST /api/sante/plan avec auth JWT, calculs BMR/TDEE serveur, appel Groq, nettoyage markdown JSON, gestion cache
- server.js : montage route /api/sante
- routes/profil.js : GET/POST mis à jour pour allergies et aliments_exclus

### Frontend
- Nouveau fichier public/js/sante.js : calculs locaux, rendu widget, toggle plan, appel Groq
- public/js/profil.js : suppression calculs santé, ajout champs allergies/aliments_exclus, sauvegarderSante() mis à jour
- public/js/app.js : chargement widget Santé depuis onglet bienetre
- public/js/widgets.js : widget Santé déplacé de sport → bienetre

### Styles
- Nouveau : public/css/sante.css
- Nouveau : public/css/rendezvous.css
- Nouveau : public/css/anniversaires.css
- Nouveau : public/css/admin.css
- Nouveau : public/css/astrologie.css
- style.css : .widget-choix-item alignement checkbox corrigé (label gauche, checkbox droite)
- style.css : .date-badge masqué sur mobile (display:none dans media query max-width:700px)

### Corrections
- routes/sante.js : import authenticateToken corrigé (TypeError: argument handler must be a function)
- routes/sante.js : nettoyage blocs ```json Groq avant JSON.parse
- Cache plan nutritionnel migré localStorage → Supabase (sync PC + mobile)
- sw.js : CACHE_NAME bumped → mydaily-cache-v1.28

---

## v1.16 — 26-08-2026
- fix : conseil cycle IA tronqué sur mobile — seuil porté de 120 à 220 caractères
- fix : word-break:break-word + overflow-wrap:anywhere sur bloc conseil (social.js)
- sw.js : CACHE_NAME bumped → mydaily-cache-v1.16

---

## v1.15 — 26-08-2026
- fix : commentaires imbriqués — colonne parent_id + CASCADE DELETE (post_comments)
- fix : parent_id string vs number → cast Number(parent_id) côté client (feed.js)
- fix : input réponse prérempli avec texte parent → inputEl.value = '' avant focus (feed.js)
- fix : crash mentions vides → CASE WHEN array_length > 0 (routes/feed.js)
- sw.js : CACHE_NAME bumped → mydaily-cache-v1.15

---

## v1.13 — 25-08-2026
- fix : Push muet — ON CONFLICT invalide PostgreSQL → SELECT + UPDATE/INSERT explicite (routes/push.js)
- fix : sender_id NULL dans notifications coucou/partage → ajout sender_id + envoyerPush() (routes/social.js)
- fix : regex resoudreMentions trop gourmande + safeguard mentions null (routes/feed.js)
- fix : @tag brut non cliquable → garde client + séparateur double espace (public/js/feed.js)
- fix : décalage +1 jour la nuit → _aujourdHuiLocal() minuit local (public/js/cycle.js)
- fix : endpoint FCM invalidé à chaque login → suppression unsubscribe() forcé (public/js/push.js)
- sw.js : CACHE_NAME bumped → mydaily-cache-v1.13

---

## v1.08 — 24-08-2026
- MODULE @TAG : suggestions utilisateurs temps réel à la saisie de @ (posts + commentaires + édition)
- feed.js : initMentions() — dropdown clavier/souris, insertion @Prénom NOM, debounce 200ms
- feed.js : renderContenuAvecMentions() — rendu des mentions en <span> cliquables
- feed.js : délégation clic .mention-tag → résolution user via /api/feed/users → ouvrirProfilPublic()
- feed.js : initMentions() branché sur champ nouveau post, édition post, commentaire, édition commentaire
- feed.css : .mention-tag — chip violet cliquable avec hover
- feed.css : .mention-dropdown / .mention-item — liste déroulante positionnée
- sw.js : CACHE_NAME bumped → mydaily-cache-v1.07

---

## v1.06 — 25-08-2026
- MODULE CLOCHE : panel notifications + badge rouge + onglets Tout/Non lu + sections Aujourd'hui/Plus tôt + polling badge 60s
- feed.js : notifs cloche + push pour like / commentaire / follow
- social.js : GET /notifications — prenom/nom sender + limite 10
- planning.js : purge anciens enregistrements déplacée au démarrage serveur
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
