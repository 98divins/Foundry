# Foundry — plan de correction et d'amélioration

*Rédigé le 16 novembre 2026 à partir d'une revue du dépôt (commit `3e8ef6c`). Ce document sert de feuille de route à Claude : il dit quoi corriger, dans quel ordre, et à quoi reconnaître que c'est fini.*

L'app a moins d'une semaine. Rien ici n'est à faire d'un seul coup : les lots sont classés par urgence, et chacun se termine par une validation du propriétaire.

---

## 0. Règles de travail

1. **Un lot à la fois, dans l'ordre.** À la fin d'un lot : tests verts, `npm run build` sans erreur, un résumé de ce qui a changé et la liste de ce que le propriétaire doit faire à la main (SQL à exécuter, champs à remplir). Puis attendre sa validation avant le lot suivant.
2. **Gel des fonctions.** Aucune fonction nouvelle en dehors de ce plan tant que les lots 1 à 4 ne sont pas terminés. La surface de l'app est déjà plus large que ce qui a été éprouvé par de vrais utilisateurs.
3. **Chaque correction de bug vient avec un test** qui échoue avant la correction et passe après.
4. **SQL : écrire, ne jamais exécuter.** Les changements de base sont des fichiers idempotents dans `supabase/`, que le propriétaire lance lui-même. Tout changement de règle d'accès est couvert par le banc de test du lot 1.1.
5. **Aucune donnée réelle dans la conversation** (comptes, e-mails, retours de testeurs) : uniquement des données fictives générées pour les tests.
6. **Code, commentaires et commits en anglais**, comme l'existant. Textes d'interface en français et en anglais (le test de traduction doit rester vert).
7. **Dire avant de coder** si un point du plan paraît faux, risqué ou plus coûteux que prévu, et proposer une alternative.

---

## 1. Constats de la revue

**Ce qui est solide** : 106 tests verts, TypeScript strict, aucune dépendance vulnérable, synchronisation avec écriture conditionnelle et pierres tombales, export des données, vues d'adoption, textes légaux amorcés, identité visuelle cohérente.

**Ce qui a été vérifié et pose problème** :

| # | Constat | Gravité | État |
|---|---|---|---|
| A | La règle « friendships: accept » laissait le destinataire réécrire `requester` : on pouvait devenir « ami » de n'importe quel compte sans son accord et lire ses stats, son fil et son profil. Reproduit sur Postgres local. | Critique | Corrigé dans le patch |
| B | Les aliments planifiés jamais confirmés étaient comptés dans l'estimation de dépense (2 500 → 3 300 kcal dans le test), donc dans les objectifs. | Élevée | Corrigé dans le patch |
| C | Tout l'état est un seul JSON dans `localStorage`, re-sérialisé et renvoyé en entier à chaque modification. Environ 1,7 Mo par an pour un utilisateur assidu : la limite du navigateur (≈ 5 Mo) est atteinte en trois ans. | Élevée | Lot 3 |
| D | Le verrou Pro est une constante côté client ; le dépôt est public et sans licence. | Élevée avant la vente | Lots 1 et 3 |
| E | Base d'aliments commune : un membre pouvait associer de fausses valeurs à un code-barres connu, consulté avant Open Food Facts. Pas de signalement. | Moyenne | Ordre corrigé dans le patch, signalement au lot 1 |
| F | Classements calculés et écrits par le client : trichables. | Faible entre amis | Lot 1 (borné, pas de classement public) |
| G | Textes légaux à l'état de brouillon avec champs vides, une seule case de consentement, e-mail conservé dans `feedback` après suppression du compte. | Élevée avant la vente | Suppression corrigée, reste au lot 2 |
| H | Noms de Jeff Nippard et Chris Bumstead utilisés sans accord. | Moyenne | Retirés dans le patch |
| I | PWA seule : pas de notification de fin de repos sur iPhone, pas d'Apple Santé, pas de montre. | Structurante | Lot 6 |
| J | Le lien alimentation × force, annoncé comme l'avantage distinctif, est la partie la moins développée. | Stratégique | Lot 4 |
| K | Périmètre très large (niveaux, badges, fil, défis, bilan annuel, équipement, intervalles) avant toute donnée de rétention. | Stratégique | Lot 4 |
| L | README obsolète (décrit une app sans compte). | Faible | Lot 4 |

---

## 2. Déjà fait dans le patch joint

À relire, pas à refaire. Vérifié par `npm test` (107 tests) et par un jeu de requêtes sur Postgres local.

- `supabase/security.sql` (nouveau, à lancer après tous les autres fichiers) :
  - `friendships` : seule la colonne `status` est modifiable ;
  - `delete_my_account()` efface aussi les messages de `feedback` ;
  - `shared_meals` : bornes de plausibilité sur les valeurs ;
  - table `content_reports` pour les signalements (écriture seule par les membres).
- `supabase/social.sql` : même restriction de colonne, pour les installations neuves.
- `src/nutrition.ts` : les aliments planifiés non confirmés ne comptent plus dans la dépense. Test ajouté.
- `src/screens/nutrition/AddFood.tsx` : au scan, Open Food Facts d'abord, la base commune en secours.
- `src/programs.ts`, `src/screens/Explore.tsx`, `src/i18n.fr.ts`, `docs/SPEC.md` : plus aucun nom de personnalité.

**À faire à la main par le propriétaire, tout de suite** :

1. Lancer `supabase/security.sql` dans Supabase → SQL Editor.
2. Passer le dépôt GitHub en privé.

---

## Lot 1 — Sécurité et intégrité des données

**1.1 Banc de test des règles d'accès.** Créer `supabase/tests/rls.sql` et un script `npm run test:rls` qui, sur un Postgres local, charge tous les fichiers de `supabase/` puis joue des scénarios à deux ou trois comptes fictifs. Chaque table a au moins : « un autre compte ne lit pas », « un autre compte n'écrit pas », « le propriétaire ne peut pas changer les colonnes d'identité ». Le scénario de la faille A y figure comme test de non-régression. Brancher ce script dans la CI.

**1.2 Revue colonne par colonne.** Pour chaque règle `update`, vérifier quelles colonnes sont réellement modifiables et restreindre par `grant update (colonnes)`. Tables à passer : `profiles`, `public_stats`, `activities`, `shared_meals`, `community_foods`, `user_state`.

**1.3 Signalement dans l'app.** Bouton « Signaler » sur les aliments de la communauté, les repas partagés, les commentaires et les profils, qui écrit dans `content_reports`. L'élément signalé disparaît pour celui qui l'a signalé. Ajouter une vue `admin.reports` (non exposée à l'API).

**1.4 Aliments de la communauté.** Afficher une mention « ajouté par un membre » ; limiter la création à 30 par jour et par compte (déclencheur SQL) ; ne jamais y copier un produit venu d'Open Food Facts (voir 2.6).

**1.5 Auteur des repas partagés.** Ne plus faire confiance au champ `author` envoyé par le client : le lire depuis `profiles` au moment de l'affichage, ou le remplir par déclencheur.

**1.6 Classements.** Garder le calcul côté client pour les amis, mais borner les valeurs côté serveur (contraintes sur `public_stats`). Pas de classement public ni de défi ouvert tant que les stats ne sont pas recalculées côté serveur. Le documenter dans `docs/SPEC.md`.

**1.7 Déconnexion.** Dans `signOut`, `upload()` peut renvoyer `false` (un autre appareil a écrit entre-temps) : aujourd'hui l'app se déconnecte quand même et vide l'appareil, ce qui perd les changements non envoyés. Lancer une synchronisation complète (fusion) et refuser la déconnexion tant que `dirty` est vrai.

**1.8 Horloge.** `updated_at` est fixé par l'horloge du téléphone, et la fusion compare cette heure à `lastChangeAt`. Faire poser `updated_at` par le serveur (déclencheur `now()`) et utiliser la valeur renvoyée.

**1.9 Politique de sécurité du contenu.** Ajouter une balise `Content-Security-Policy` dans `index.html` limitant les connexions à Supabase, Open Food Facts, jsDelivr et GitHub. Passer à de vrais en-têtes lors du changement d'hébergeur (2.7).

**1.10 Réglages Supabase à vérifier à la main** (produire une liste à cocher dans `supabase/README.md`) : confirmation d'e-mail activée, protection contre les mots de passe compromis, limites de débit, service d'e-mail propre, région européenne confirmée, sauvegardes, accord de sous-traitance signé.

**Critère de fin** : `npm run test:rls` vert dans la CI ; aucun scénario « autre compte » ne passe.

---

## Lot 2 — Juridique : proposition complète

*Proposition rédigée sans avocat. Elle vise un état propre pour la bêta et une base sérieuse pour la relecture juridique avant le lancement payant. Le nom Foundry est conservé pour l'instant ; une recherche d'antériorité (INPI, EUIPO) reste à faire avant d'investir dans la marque.*

### 2.1 Identité de l'éditeur

Créer `src/legalConfig.ts`, seul endroit où le propriétaire renseigne : nom et prénom ou raison sociale, statut, SIREN, adresse, e-mail de contact, directeur de la publication, hébergeur de l'app, région Supabase, médiateur de la consommation (au lancement payant). Tant qu'un champ est vide, la page « À propos » affiche un bandeau « bêta privée » et le build de production échoue si `LEGAL_DRAFT` est faux.

### 2.2 Documents (français et anglais, versionnés)

| Document | Contenu attendu |
|---|---|
| **Mentions légales** (nouveau) | Éditeur, contact, directeur de la publication, hébergeurs avec adresse. |
| **Politique de confidentialité** | Voir 2.4. |
| **Conditions d'utilisation** | Service, compte, âge, pas d'avis médical, contenus des membres et modération, suspension, propriété intellectuelle, responsabilité, droit applicable. |
| **Règles de la communauté** (nouveau, court) | Ce qu'on peut partager, ce qui est retiré, comment signaler, comment contester. |
| **Conditions de vente** (brouillon, masqué jusqu'à la vente) | Prix TTC, durée, renouvellement, résiliation, droit de rétractation de 14 jours et ses modalités, garantie légale de conformité des services numériques, médiateur de la consommation. À caler avec le juriste ; via les stores, paiement et remboursement passent par Apple ou Google. |
| **Sources et licences** (nouveau) | Voir 2.6. |

### 2.3 Consentement : séparer

Aujourd'hui une seule case couvre tout à l'inscription. Proposition :

- **À l'inscription** : une case obligatoire, « J'ai 16 ans ou plus et j'accepte les conditions d'utilisation », et un lien d'information vers la politique de confidentialité (une information, pas un consentement).
- **À l'activation de la nutrition ou de la première pesée** : un consentement distinct et explicite pour les données de santé. Texte proposé : « J'accepte que Foundry traite mon poids, mes mesures et ce que je mange pour calculer mes objectifs et mes statistiques. Ces données sont des données de santé. Je peux retirer cet accord à tout moment dans Réglages → Confidentialité, ce qui les efface. »
- **Retrait aussi simple que l'accord** : Réglages → Confidentialité → « Retirer mon accord et effacer mes données nutrition et poids ». Efface journal, pesées, profil nutrition et bilans, sur l'appareil et sur le compte ; l'entraînement reste.
- Enregistrer `healthConsent { at, version }` séparément de `consent`. Les comptes existants gardent leur accord (il mentionnait déjà les données de santé).

### 2.4 Politique de confidentialité : ce qu'elle doit contenir

- **Bases légales** : exécution du contrat pour le compte et le service ; consentement explicite pour les données de santé ; intérêt légitime pour la sécurité et les statistiques d'usage agrégées.
- **Destinataires et sous-traitants**, chacun avec son rôle et son pays : Supabase (base et authentification), hébergeur de l'app, Open Food Facts (mots recherchés et codes-barres, sans identité), jsDelivr et GitHub (photos d'exercices). Mentionner les transferts hors Union européenne et leur encadrement.
- **Fonctions sociales** : ce que voient les amis (résumé chiffré, fil, profil), ce que voient tous les membres (repas et aliments partagés, profil public s'il est activé), comment tout désactiver.
- **Durées** : compte actif ; compte inactif 24 mois → e-mail d'avertissement → suppression 30 jours après ; messages de contact et signalements 12 mois ; sauvegardes selon le cycle de l'hébergeur. Les aliments ajoutés à la base commune restent, sans lien avec la personne.
- **Statistiques d'usage** : les vues `admin.*` lisent les données synchronisées. Les réécrire pour ne produire que des comptages (jamais de poids ni de calories) et retirer l'e-mail de `admin.users`, sauf besoin de support ; le dire dans la politique.
- **Droits** : accès, rectification, effacement, portabilité, retrait du consentement, opposition, limitation, réclamation auprès de la CNIL ; réponse sous un mois.
- **Décision automatisée** : les objectifs sont des estimations que l'utilisateur peut modifier ; aucune décision à effet juridique.
- **Portabilité** : ajouter à l'export les données sociales (profil, repas partagés, commentaires).

### 2.5 Garde-fous santé

L'app propose des déficits caloriques : c'est le point le plus sensible, pour les utilisateurs comme pour la validation des stores.

- Objectifs de perte de poids réservés aux 18 ans et plus (l'année de naissance est déjà demandée).
- Pas d'objectif de perte si l'IMC est inférieur à 18,5 : proposer le maintien, avec un message neutre et un lien vers une ressource d'aide (à choisir par le propriétaire).
- Rythme de perte plafonné à 1 % du poids par semaine ; planchers actuels conservés.
- Si le poids tendance passe sous un IMC de 18,5 pendant une perte, proposer de repasser en maintien.
- Rappel « estimations, pas un avis médical » à la mise en place de la nutrition, pas seulement dans les conditions.
- Vocabulaire : jamais « diagnostic », « traitement », « prescription ». Remplacer « coach adaptatif » par « objectifs adaptatifs » : l'app ne doit pas se présenter comme un dispositif médical ni comme un suivi personnalisé par un professionnel.

### 2.6 Tiers, marques et licences

- **Aucun nom, image ou marque de personne réelle** sans accord signé (fait dans le patch ; ajouter un test qui échoue si un nom d'une liste interdite réapparaît).
- **Hevy** : mention limitée à la description du format de fichier importé (« Importer un CSV au format Hevy »), sans logo.
- **Page « Sources et licences »** avec liens : Open Food Facts (ODbL), USDA FoodData Central, TempoLife (CC-BY 4.0), Free Exercise DB, polices (OFL). Afficher « Données : Open Food Facts » près des résultats concernés.
- **Open Food Facts et base commune** : garder les deux strictement séparées. Un aliment venu d'Open Food Facts n'est jamais republié dans `community_foods`, sinon la base commune devient une base dérivée soumise au partage à l'identique.
- **Photos d'exercices** : vérifier la provenance et la licence réelles des images avant la vente.
- **Dépôt** : ajouter un fichier `LICENSE` « Tous droits réservés » et une mention de droit d'auteur.

### 2.7 Conformité interne : modèles à produire, décisions au propriétaire

Générer dans `docs/legal/`, pré-remplis à partir du code :

- `REGISTRE.md` : registre des traitements (obligatoire dès lors que des données sensibles sont traitées, quelle que soit la taille).
- `AIPD.md` : analyse d'impact allégée (recommandée ; obligatoire si le traitement devient à grande échelle).
- `PROCEDURES.md` : demande de droits (un mois), violation de données (notification sous 72 heures), retrait de contenu signalé.

Points que seul le propriétaire peut traiter : accord de sous-traitance Supabase ; statut juridique avant le premier euro encaissé ; médiateur de la consommation au lancement payant ; faire confirmer par le juriste que l'hébergement n'exige pas la certification « hébergeur de données de santé » (à revoir si une offre pour professionnels voit le jour) ; **changer d'hébergeur avant la vente**, les conditions de GitHub Pages excluant en principe l'usage commercial de type SaaS (à vérifier), ce qui permettra aussi un domaine propre et de vrais en-têtes de sécurité.

**Critère de fin** : plus aucun champ entre crochets dans les textes affichés ; deux consentements distincts et tracés ; retrait du consentement santé testé de bout en bout ; export complet.

---

## Lot 3 — Données, synchronisation et droit d'accès Pro

Écrire d'abord `docs/SYNC_V2.md` (conception, migration, retour arrière) et attendre la validation.

**3.1 Stockage local.** Passer de `localStorage` à IndexedDB, d'abord à forme identique (migration automatique, ancienne clé gardée en lecture 30 jours). Écriture différée et hors du fil principal.

**3.2 Synchronisation par élément.** Remplacer l'envoi du bloc entier par des lignes par élément (`kind`, `id`, `data`, `updated_at` posé par le serveur, `deleted`), avec règles d'accès par propriétaire. Récupération par « modifié depuis ». La logique de fusion existante et ses tests sont conservés.

**3.3 Migration.** Conversion unique du bloc `user_state` ; le bloc reste en lecture seule 30 jours pour pouvoir revenir en arrière.

**3.4 Calculs.** Mémoriser les calculs relancés à chaque rendu (`expenditureSeries`, tendances, records).

**3.5 Droit d'accès Pro côté serveur.** Table `entitlements (user_id, plan, expires_at)` lisible par son propriétaire, modifiable uniquement par le rôle de service. `hasPro()` la lit ; l'interrupteur de bêta reste. Rien n'est vendu à ce stade : c'est la fondation.

**Critère de fin** : avec un jeu de données fictif de cinq ans, démarrage sous une seconde, validation d'une série sans blocage perceptible, moins de 10 ko envoyés par modification.

---

## Lot 4 — Produit : au niveau sur l'essentiel, meilleur sur deux points

Être compétitif partout dès maintenant n'est pas réaliste face à des équipes installées. L'ordre proposé : **à parité sur la vitesse et la fiabilité de la saisie**, **meilleur sur la nutrition en français et sur le lien alimentation × entraînement**.

**4.1 Mesurer avant d'ajouter.** Utiliser les vues `admin.cohorts` et `admin.features` pendant la bêta. Indicateurs à suivre : première série notée, troisième séance, usage en semaine 2, part des comptes qui notent des repas.

**4.2 Resserrer.** Créer `src/features.ts` avec un interrupteur par fonction. Proposition par défaut pendant la bêta : équipement, niveaux et badges, défis, bilan annuel et commentaires du fil derrière un réglage « Fonctions en test ». Rien n'est supprimé ; on réactive ce que les données justifient.

**4.3 Séance : parité avec les références.**
- Suggestion de progression : fourchette atteinte sur toutes les séries → proposer la charge supérieure ; sinon rappeler la cible (« dernière fois 80 × 8, 8, 7 : vise 8, 8, 8 »).
- Calculateur de disques, séries d'échauffement générées, champ d'effort perçu facultatif, note épinglée par exercice, consignes d'exécution.
- Import d'historique dès l'accueil (« Importe ton historique en une minute ») : Hevy existe, ajouter le format Strong.

**4.4 Nutrition : la vitesse de saisie décide de la rétention.**
- Remplacer la liste de 373 aliments par la table Ciqual de l'Anses (environ 3 000 aliments en français ; vérifier la licence et la version), convertie en JSON compact chargé à la demande et utilisable hors ligne.
- Classement de recherche : récents et fréquents d'abord selon le créneau et l'heure ; résultats locaux immédiats, Open Food Facts ajouté ensuite ; cache local des produits scannés.
- « Copier le repas d'hier », ajout de plusieurs aliments d'un coup, portions usuelles.
- Cible : noter un petit-déjeuner habituel en moins de dix secondes.

**4.5 Le différenciateur : alimentation × force.**
- Carte hebdomadaire visible dès la deuxième semaine : écart calorique moyen, protéines par kilo, évolution de l'indice de force.
- **Bilan de phase** : marquer une période comme sèche, maintien ou prise, puis comparer l'évolution de la force et du poids d'une phase à l'autre.
- Conseils déclenchés par des règles explicites avec seuils de données minimaux (par exemple : déficit, force en baisse deux semaines de suite et protéines sous 1,6 g/kg). Formulation prudente, jamais causale.
- Tests sur jeux de données synthétiques pour chaque règle.

**4.6 Qualité perçue.**
- Tests de bout en bout (Playwright) sur cinq parcours : inscription, noter une séance, noter un repas, synchroniser deux appareils, supprimer le compte.
- ESLint et Prettier dans la CI ; découpage du code par écran ; passe d'accessibilité ; états vides et hors ligne.
- Réécrire le README pour décrire l'app telle qu'elle est.

---

## Lot 5 — Gratuit et payant : proposition, à trancher avec les données

Le positionnement n'est pas arrêté : ce lot rend la décision facile à changer plutôt que de la figer.

**5.1 Retirer la partie coachs.** Programmes de coachs partenaires et offre coachs ou salles sortent de l'app, de `pro.ts` et du corps de `docs/BUSINESS_MODEL.md`, déplacés dans une section « Idées reportées ».

**5.2 Une règle simple à la place du « 70/30 par partie ».** *Gratuit : noter, consulter, partager. Pro : ce que l'app calcule pour toi.*

| Option | Gratuit | Pro | Intérêt |
|---|---|---|---|
| **A (recommandée)** | Tout le suivi de séance sans quota, journal alimentaire, amis | Objectifs adaptatifs et bilan hebdomadaire, analyses alimentation × force et bilan de phase, historique complet des graphiques, planification longue, export Excel | Plus généreux que les références sur la séance (levier d'acquisition), payant sur ce qui est unique |
| **B (actuelle)** | Quotas sur routines, dossiers, exercices, repas | Quotas levés et analyses | Proche de l'existant, mais la partie séance se compare à des offres à environ 2 € par mois |

Dans les deux cas, retirer les verrous qui diluent la promesse ou freinent la croissance : couleurs du thème, fusion de routines, remplissage depuis une routine, face-à-face entre amis, partage de repas (il enrichit la base commune).

**5.3 Rendre la règle réglable.** Toutes les limites dans un seul objet de configuration, surchargeable par une table `app_config` lue au démarrage, pour tester une variante sans redéployer. L'interrupteur de bêta reste actif.

**5.4 Page Abonnement.** Tant que rien n'est vendu, afficher les formules comme « prévues » sans promesse d'essai ni de prix ferme. Les prix restent une hypothèse à revoir après la bêta.

---

## Lot 6 — Plus tard, à ne pas commencer sans accord

App native (Capacitor) avec notifications, Apple Santé et Health Connect, activité en direct ; achats intégrés et mise à jour de `entitlements` par le serveur ; conditions de vente activées ; publication sur les stores ; montre.
