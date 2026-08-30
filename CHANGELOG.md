# Changelog MoaDja

---

## v1.56 — 30-08-2026

### ✨ Nouveau
- Cliquer sur une notification redirige vers l'onglet concerné : coucou → Bien-être (widget cycle/mood), partage → Profil, like/commentaire/mention → Accueil avec scroll automatique vers le post
- Les rappels push (tâche, agenda, anniversaire) ouvrent directement l'onglet Quotidien au tap

### 🔧 Corrections
- Fichier parasite supprimé du VPS

---

## v1.55 — 30-08-2026

### ✨ Nouveau
- Message retard conditionnel selon les rapports non protégés en base : 1-3j stress/fatigue 🌿, 4-7j sans rapport → variation hormonale 🤍, 4-7j avec rapport non protégé → test de grossesse, 8j+ → gynécologue 🩺
- Chargement du journal sur deux mois si le cycle chevauche deux mois calendaires

---

## v1.54 — 30-08-2026

### ✨ Nouveau
- Message bienveillant permanent dans le bandeau de retard dès le chargement
- "Signaler un retard" enregistre silencieusement dans le journal

### 🔧 Corrections
- Durée des règles calculée depuis l'historique au lieu d'être fixée à 5 jours
- Doublon du bouton "+ Enregistrer mes règles" supprimé
- "sage-femme" remplacé par "gynécologue"

---

## v1.48 — 30-08-2026

### ✨ Nouveau
- Champ Praticien pour les événements Médicaux, distinct du lieu
- Champ Lieu disponible pour toutes les catégories
- Liste déroulante des employeurs existants pour Travail et Mission

### 🔧 Corrections
- Route `/api/agenda/employeurs` interceptée par `/:id` — corrigé
- "Repos — Repos" masqué dans le détail et le widget Social
- Champ Employeur repositionné dans le formulaire

---

## v1.47 — 30-08-2026 🏷️ Stable

### ✨ Nouveau
- Agenda unifié : Planning et Rendez-vous fusionnés — tous types d'événements
- Catégories avec sous-catégories mémorisées et réutilisables
- Vue calendrier mensuel avec code couleur, widget 3 jours priorité hors Repos
- Rappels push couvrent toutes les entrées agenda

### 🔧 Corrections
- Références aux anciennes tables supprimées dans admin et push

---

## v1.46 — 30-08-2026 🏷️ Stable

### ✨ Nouveau
- Météo : mémorisation du mode et des coordonnées, rafraîchissement auto 30 min ou déplacement >5 km, fallback ville profil

---

## v1.45 — 29-08-2026

### ✨ Nouveau
- Widget Prière Islam : bandeau et bouton "Compléter le profil" si coordonnées GPS manquantes

---

## v1.44 — 29-08-2026

### ✨ Nouveau
- Hashtags cliquables dans le feed avec filtre actif et bouton de réinitialisation

### 🔧 Corrections
- Mentions @Tout le monde cassées après l'ajout des hashtags — corrigé

---

## v1.43 — 29-08-2026

### ✨ Nouveau
- Thème Astral : bouton "Calculer mon thème natal" au premier affichage
- Astrologie : bouton "Compléter le profil" si date de naissance manquante

### 🔧 Corrections
- Photo post Android : galerie proposée par défaut au lieu de la caméra
- Icônes météo manquantes sur conditions rares corrigées
- Texte "Mis à jour chaque jour" remplacé par "Thème natal · Données permanentes"
- Widget Santé : bandeau profil incomplet au lieu d'une erreur brute

---

## v1.42 — 29-08-2026 🏷️ Stable

### ✨ Nouveau
- Thème Astral : Milieu du Ciel, Ascendant, Lune, Soleil affichés — astrologie occidentale tropicale

### 🔧 Corrections
- Milieu du Ciel affichait "Heure requise" à tort — corrigé
- Variables d'environnement non chargées au démarrage — corrigé

---

## v1.41 — 28-08-2026 🏷️ Stable

### ✨ Nouveau
- Thème astral calculé une seule fois à vie
- Notifications limitées à 6 par défaut avec bouton "Voir plus"
- Cloche et menu profil se ferment mutuellement

### 🔧 Corrections
- Icônes widgets absentes dans l'administration — corrigé
- @Tout le monde s'affichait en noir au lieu de violet — corrigé

---

## v1.37 — 27-08-2026 🏷️ Stable

### ✨ Nouveau
- Photos de profil hébergées sur nos serveurs

---

## v1.36 — 27-08-2026 🏷️ Stable

### ✨ Nouveau
- Application renommée MoaDja, accessible sur moadja.fr
- @toutlemonde disponible pour les administrateurs

### 🔧 Corrections
- Calendrier du cycle réparé
- Statistiques administration corrigées

---

## v1.30 — 26-08-2026 🏷️ Stable

### ✨ Nouveau
- Administration : activité récente, top 5 membres, widgets les plus utilisés

---

## v1.28 — 26-08-2026 🏷️ Stable

### ✨ Nouveau
- Module Santé : IMC, calories, macros calculés depuis le profil
- Plan repas et activités généré chaque jour par l'IA

---

## v1.13 — 25-08-2026

### 🔧 Corrections
- Notifications manquantes sur certains appareils, expéditeur absent, mentions incorrectes, date décalée en soirée, session déconnectée entre visites — tout corrigé

---

## v1.08 — 24-08-2026

### ✨ Nouveau
- Mentions @nom avec suggestions temps réel et clic vers le profil public

---

## v1.06 — 25-08-2026

### ✨ Nouveau
- Cloche notifications avec badge, sections Aujourd'hui / Plus tôt, likes, commentaires, abonnements

---

## v1.00 — 24-08-2026 🏷️ Stable

### ✨ Nouveau
- Lancement de MoaDja — Profil, Feed, Planning, Tâches, Rendez-vous, Anniversaires, Cycle, Islam, Prières, Astrologie, Social, Push, Administration — PWA installable
