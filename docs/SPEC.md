# Foundry — Rétro-spécification

*État de l'application au 16 novembre 2026 (branche `main`, version 0.1.0). Document décrit à partir du code existant.*

## 1. Vision et positionnement

**Foundry** est une application mobile (PWA) qui réunit **le suivi de musculation** et **le suivi nutritionnel adaptatif** dans un seul outil, avec une couche **sociale** (amis, classements, partage).

- **Promesse** : « L'entraînement et la nutrition, forgés au même endroit. »
- **Différenciation** : relier ce que l'on mange à l'évolution de sa force (analyses croisées diète × entraînement), là où les applications concurrentes traitent l'un ou l'autre.
- **Cible** : pratiquants de musculation francophones, débutants à confirmés, qui veulent progresser avec méthode.
- **Langues** : français et anglais (interface et noms d'exercices réglables séparément).

## 2. Architecture

| Élément | Choix |
|---|---|
| Front | React 18 + TypeScript strict, Vite 5 |
| Distribution | PWA installable (écran d'accueil iOS/Android), hébergée sur GitHub Pages |
| Hors ligne | Service worker (pages revalidées à chaque ouverture, ressources en cache) |
| Données locales | `localStorage` (clé `foundry:v1`), un seul objet d'état |
| Back-end | Supabase : authentification e-mail/mot de passe (PKCE), base Postgres avec Row Level Security, Realtime |
| Polices | Archivo (titres, chiffres) et IBM Plex Sans, intégrées à l'app |
| Déploiement | GitHub Actions à chaque push sur `main` (tests puis build) |
| Mises à jour | Fichier `version.json` comparé à chaque ouverture ; bandeau « Mettre à jour » |
| Tests | Vitest (95 tests) : logique, synchronisation, fusion, nutrition, objectifs, traductions, export |

### Tables Supabase

| Table | Contenu | Accès |
|---|---|---|
| `user_state` | Toutes les données d'un utilisateur (JSON) | Lecture/écriture par le propriétaire uniquement |
| `profiles` | Pseudo, nom affiché, photo | Soi-même et personnes liées (demande ou amitié) |
| `friendships` | Demandes et amitiés | Les deux personnes concernées |
| `public_stats` | Résumé d'entraînement partagé | Soi-même et amis acceptés |
| `shared_meals` | Repas partagés | Lecture : tous les membres ; écriture : l'auteur |
| `community_foods` | Aliments créés par les membres | Lecture : tous ; écriture : l'auteur |
| `feedback` | Messages « Nous contacter » | Écriture seule par l'utilisateur ; lecture par l'administrateur |

Fonctions : `delete_my_account()`, `find_profile(pseudo)`, `is_friend()`, `is_connected()`.

## 3. Comptes et synchronisation

- **Compte obligatoire** : écran d'accueil → création de compte ou connexion. Mot de passe d'au moins 8 caractères, réinitialisation par e-mail.
- **Consentement à l'inscription** : conditions d'utilisation, politique de confidentialité et traitement des données de santé (RGPD art. 9), 16 ans et plus. Version enregistrée ; les comptes anciens sont invités à accepter une fois.
- **Démarrage rapide** (nouveau compte vide) : jours d'entraînement visés par semaine, unité de poids, unité de taille, langue de l'app, langue des exercices, puis choix du point de départ (programme, routine, nutrition).
- **Synchronisation automatique** : chaque modification part 2 s après, au retour dans l'app et au retour du réseau.
- **Fusion sans question** : si le même compte a changé sur deux appareils, les listes sont fusionnées élément par élément ; les suppressions sont propagées (pierres tombales conservées 180 jours) ; la version la plus récente l'emporte pour les réglages.
- **Écriture conditionnelle** : l'envoi n'est accepté que si la copie du cloud n'a pas changé depuis ; sinon nouvelle fusion puis nouvel essai.
- **Isolation des comptes** : les données d'un compte ne passent jamais dans un autre ; un nouveau compte démarre vide.
- **Déconnexion** : envoie ce qui reste puis vide l'appareil.
- **Suppression du compte** depuis l'app.

## 4. Navigation

Quatre onglets : **Séance · Nutrition · Amis · Profil**.
- Séance donne accès à l'Historique et aux Exercices.
- Profil contient les progrès, les objectifs, les statistiques avancées et les Réglages (roue dentée).

## 5. Entraînement

### 5.1 Bibliothèque d'exercices
- 451 exercices (noms FR/EN), photos de démonstration (Free Exercise DB, domaine public).
- Cinq types de mesure : poids × répétitions, poids du corps (lest facultatif), assisté, durée, cardio (distance et durée).
- Filtres par muscle et matériel, recherche sans accents, exercices personnalisés.
- Fiche exercice : records (plus lourd, 1RM estimé, répétitions max, etc.), courbe de progression par séance, séances récentes.

### 5.2 Routines et programmes
- Routines avec séries visées (nombre ou fourchette, ex. 8-12), charge, repos par exercice, notes, supersets.
- Dossiers (renommer, réordonner, supprimer avec ou sans leurs routines).
- **Fusion de routines** d'un même dossier en une nouvelle routine nommée.
- Dupliquer, déplacer, partager par lien (un dossier entier ou une routine), importer depuis un lien.
- Résumé de routine : exercices, séries, durée estimée, séries par muscle.
- **Explorer les programmes** : Full Body (3 j), Haut/Bas (4 j), Push/Pull/Legs (3–6 j), copiés dans un dossier. Fiches « Bientôt » : programmes futurs écrits par Foundry (aucun nom de personnalité sans accord signé).

### 5.3 Séance en cours
- Démarrage libre ou depuis une routine ; nom modifiable.
- Par série : colonne « Précédent » (dernière séance), poids, répétitions (objectif affiché), validation. Une série vide validée reprend les chiffres précédents.
- Types de série : normale, échauffement, dégressive, échec.
- Minuteur de repos automatique (−15 s / +15 s / passer), bip et vibration, signalement d'un repos terminé app fermée.
- **Pause** du chrono de séance (temps exclu de la durée) et du minuteur de repos.
- Écran maintenu allumé (réglable).
- Terminer à tout moment : séries validées, et au choix les séries remplies non validées ; les séries vides sont ignorées. Abandon possible.
- Mini-barre de la séance en cours sur les autres écrans.

### 5.4 Historique
- Séances par mois, durée, volume, nombre de records, exercices.
- Recherche par nom de séance ou d'exercice.
- Détail d'une séance : records par série, 1RM estimé, enregistrer comme routine, modifier, supprimer.
- **Ajouter une séance passée**, avec remplissage depuis une routine (chiffres de la dernière séance avant cette date).

## 6. Nutrition

### 6.1 Plan
- Profil : sexe, année de naissance, taille, activité hors séances, poids.
- Objectif de variation de poids par semaine (perte, maintien, prise).
- **Plans de macros** : Équilibré, Athlète, Prise de muscle, Perte de gras, Après une perte de poids, Moins de glucides ; chacun affiché avec sa répartition pour les calories de l'utilisateur. Perso (Pro) : protéines en g/kg et part des lipides.
- Jour du bilan hebdomadaire. Planchers : 1 200 kcal (femmes), 1 500 kcal (hommes).

### 6.2 Moteur adaptatif
- Dépense initiale : Mifflin-St Jeor × activité.
- Poids tendance : moyenne mobile exponentielle des pesées.
- Dépense adaptative : sur 21 jours, apport moyen moins la pente du poids × 7 700 kcal/kg ; l'estimation se rapproche chaque jour de cette valeur.
- **Bilan hebdomadaire** : nouveaux objectifs (calories, protéines, glucides, lipides) proposés et appliqués.
- Les jours marqués « incomplets » sont exclus de l'estimation.

### 6.3 Journal du jour
- Six créneaux : petit-déjeuner, collation du matin, déjeuner, collation de l'après-midi, dîner, collation du soir.
- Repas **repliés** par défaut (une ligne de totaux), dépliables.
- Carte calories (restant / dépassement), barres de macros, pesée du jour.
- Navigation jusqu'à 60 jours dans le futur.

### 6.4 Ajouter un aliment
- **Recherche** : 373 aliments français intégrés, aliments récents et favoris, 5 937 aliments de base en anglais (à la demande), marques via Open Food Facts, **aliments de la communauté**.
- **Scan de code-barres** (caméra) : aliments de la communauté puis Open Food Facts ; saisie manuelle possible.
- **Ajout rapide** : calories et macros directes.
- **Créer un aliment** depuis l'étiquette, publié dans la base commune (option cochée par défaut).
- Quantité en grammes ou en portions, favoris.

### 6.5 Repas
- **Mes repas** : repas enregistrés (ingrédients, portions), notés en une touche, modification avec mise à jour rétroactive facultative des jours déjà notés.
- **Partage** d'un repas avec la communauté (privé par défaut).
- **Explorer** : 14 idées Foundry équilibrées (filtres petit-déjeuner, plat, collation, végétarien) et section **Communauté** (repas partagés, recherche). Ajout à mes repas ou planification directe.

### 6.6 Planification
- Les aliments placés sur un jour futur sont **prévus** : affichés en grisé, non comptés.
- Le jour J : « Tout confirmer », « J'ai mangé ce repas » ou validation aliment par aliment.
- **Planifier sur d'autres jours** un repas du jour ou un repas enregistré : créneau, cette semaine / semaine prochaine / mois, raccourcis « Tous les jours » et « Lun – ven ».

### 6.7 Poids et dépense
- Pesées, tendance, variation par semaine, graphique 30 / 90 jours / tout.
- Écran Dépense : estimation, apport moyen, jours notés, historique des bilans, explications.

## 7. Progrès, objectifs et statistiques

- **Carte de profil** : photo, nom, bio, séances, records sur 30 jours.
- **Objectifs hebdomadaires** : jours d'entraînement visés, et jours dans la cible diète (jour complet, calories à ±10 %, protéines ≥ 90 %). Barres de la semaine, 8 dernières semaines, taux de réussite.
- **Série de semaines** (au moins une séance par semaine) : flamme sur l'onglet Séance, notification une fois par jour à l'ouverture.
- **Jours d'entraînement** : plusieurs routines le même jour comptent pour un.
- Indice de force (1RM estimé de chaque mouvement par rapport à la première séance), tendances par mouvement, séries par semaine (séries, jours, séances, volume), séries par muscle avec repères 10–20, records des 30 jours.
- **Alimentation × entraînement** : tableau hebdomadaire et analyses (protéines et force, perte de poids et force).
- **Statistiques avancées** : équilibre musculaire (radar, période contre période précédente), muscles semaine par semaine, exercices principaux, bilan du mois (totaux et écarts, jours par mois, calendrier, radar).

## 8. Social

- **Pseudo unique** et nom affiché ; recherche par pseudo exact (pas de liste publique des utilisateurs).
- **Invitation par lien** (feuille de partage du téléphone), ajout par pseudo, demandes à accepter ou refuser.
- **Mises à jour en direct** (Realtime) avec rafraîchissement de secours ; pastille du nombre de demandes sur l'onglet Amis.
- **Classement** par période (semaine, 1 mois, 6 mois, 1 an) : jours d'entraînement, objectifs atteints, séries, volume, cardio, semaines d'affilée, records, progrès de force.
- **Face-à-face** avec un ami : score, période, régularité, 1RM estimés au squat, développé couché, soulevé de terre et développé militaire.
- **Vie privée** : seul un résumé chiffré est partagé, uniquement avec les amis acceptés ; partage désactivable.

## 9. Réglages

- Compte : profil (photo, nom, bio), e-mail, mot de passe, synchronisation, suppression du compte.
- Préférences : minuteur par défaut, bip, écran allumé, premier jour de la semaine ; unités (kg/lb, km/miles, cm/pieds-pouces) ; langue ; thème (système/clair/sombre, couleur principale parmi 8 ou personnalisée, noir pur).
- Données : sauvegarde JSON, restauration, import CSV Hevy, export CSV, **export Excel** (rapport hebdomadaire, séances, séries, pesées, jours, journal alimentaire, bilans), effacement.
- Aide : guide de démarrage, FAQ, **Nous contacter** (idée, bug, question, autre ; envoi dans l'app), recommander l'app, à propos (version et date).
- Mentions légales : politique de confidentialité, conditions d'utilisation (versions préliminaires).

## 10. Identité visuelle

- Nom et métaphore : la fonderie, où l'on forge un physique avec méthode.
- Logo : lingot avec un F découpé et une étincelle cuivrée.
- Couleurs : bleu cobalt (principal), cuivre (records, trophées, séries de semaines).
- Typographie : Archivo (large, chiffres), IBM Plex Sans (texte).
- Signature : boutons principaux à coin coupé ; thème sombre par défaut.

## 11. Qualité, sécurité, conformité

- Écran de secours en cas de bug (recharger, revenir à l'accueil, copier les détails).
- Polices locales : aucune requête vers Google.
- Données d'un compte accessibles à son seul propriétaire (Row Level Security) ; clés de service jamais dans l'app.
- Accessibilité : libellés sur les boutons-icônes, tailles de champs 16 px (pas de zoom iOS), zones de sécurité iPhone gérées.

## 12. Fonctions Pro (gratuites pendant la bêta)

Plan de macros personnalisé, équilibre musculaire, bilan du mois. Un interrupteur unique (`pro.ts`) les verrouillera à l'arrivée de l'abonnement.

## 13. Limites connues et chantiers

| Sujet | État |
|---|---|
| E-mails (confirmation, mot de passe oublié) | Service Supabase par défaut, très limité ; prévoir un domaine et un service d'envoi |
| Notifications (repos app fermée, demandes d'amis) | Nécessitent une app native (Capacitor) |
| Publication sur les stores | Comptes Apple/Google, app native, fiches store |
| Abonnement | À brancher (RevenueCat), page d'offre |
| Modération | Signalement des repas et aliments partagés à prévoir |
| Textes légaux | À compléter (éditeur, contact, région d'hébergement) et faire relire |
| Programmes de coachs | Coquilles « Bientôt » ; contenu par partenariat |
| Analyse de repas par photo (IA) | Étudiée, reportée |
| Apple Santé / Health Connect | Non commencé |
