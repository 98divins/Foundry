# Foundry — Business model

*Version 1, novembre 2026. Les chiffres de marché et de prix concurrents sont des ordres de grandeur à vérifier ; les projections sont des hypothèses de travail, pas des prévisions.*

## 1. En une phrase

Foundry est une application **freemium par abonnement** : le suivi de musculation est gratuit et complet pour attirer et retenir, et l'abonnement **Foundry Pro** débloque le coaching nutritionnel adaptatif et les analyses qui relient l'alimentation à la progression.

## 2. Le problème et la proposition de valeur

**Le problème** : les pratiquants de musculation qui veulent progresser jonglent entre deux apps (une pour les séances, une pour la nutrition), qui ne se parlent pas. Ils ne savent pas si leur stagnation vient de l'entraînement, de l'alimentation ou des deux, et les apps de nutrition grand public ne sont pas pensées pour eux.

**La proposition de valeur** :
1. **Tout au même endroit** : séances, repas, poids, objectifs.
2. **Une nutrition qui s'adapte** : la dépense réelle est estimée à partir du poids et de ce qui est mangé, et les objectifs sont ajustés chaque semaine.
3. **Le lien diète × force** : voir si ses semaines riches en protéines ou en déficit changent sa progression. C'est l'avantage distinctif.
4. **La motivation par le groupe** : amis, classements équitables (régularité, objectifs atteints, progrès relatif), face-à-face.
5. **En français**, avec des aliments et des repas du quotidien français.

## 3. Segments de clients

| Segment | Besoin principal | Rôle |
|---|---|---|
| **Pratiquants réguliers** (3–5 séances par semaine, 18–40 ans) | Progresser, suivre leurs charges, gérer leur physique | Cœur de cible, principaux payants |
| **Débutants motivés** | Être guidés : programme, objectifs simples | Volume d'utilisateurs gratuits, conversion plus tard |
| **Personnes en recomposition** (perte de gras ou prise de muscle) | Ajuster leurs calories sans se tromper | Fort besoin de la partie Pro |
| **Groupes d'amis / salles** | Se motiver ensemble | Croissance par invitation |
| **Coachs** (phase 2) | Suivre plusieurs clients | Offre B2B future |

## 4. Offre et prix

### 4.1 Gratuit (pour toujours)
- Suivi de séances complet : bibliothèque, routines, dossiers, minuteur, historique, records.
- Programmes de base.
- Journal alimentaire, scan, base d'aliments et repas de la communauté.
- Objectif calorique de départ (non adaptatif).
- Amis, classement de la semaine.
- Synchronisation et sauvegarde dans le compte.

*Le gratuit doit être assez bon pour remplacer une app de musculation gratuite : c'est lui qui fait venir et rester les utilisateurs.*

### 4.2 Foundry Pro
- **Coach nutrition adaptatif** : dépense estimée chaque jour, bilan hebdomadaire et nouveaux objectifs.
- Plans de macros personnalisés.
- **Analyses diète × entraînement**, statistiques avancées (équilibre musculaire, bilan du mois, tendances longues).
- Classements sur 1 mois, 6 mois et 1 an, face-à-face détaillé.
- Planification des repas au mois.
- Export Excel complet.
- Plus tard : analyse de repas par photo (IA), programmes de coachs partenaires.

### 4.3 Prix proposés (lancement France)

| Formule | Prix | Équivalent mensuel |
|---|---|---|
| Mensuel | **5,99 €** | 5,99 € |
| Annuel | **39,99 €** | 3,33 € (−44 %) |
| À vie (offre de lancement, quantité limitée) | **89,99 €** | — |

- **Essai gratuit de 7 jours** sur l'annuel.
- **Repères concurrents** (ordres de grandeur, à vérifier) : les apps de musculation se situent autour de 3 € par mois, les apps de nutrition adaptative autour de 10 à 12 € par mois. Foundry réunit les deux pour **moins que la nutrition seule**.
- **Mise en avant de l'annuel** : meilleure rétention, trésorerie immédiate.
- **Prix « bêta »** pour les premiers testeurs (par exemple −50 % à vie) en remerciement et pour obtenir des avis sur les stores.

## 5. Sources de revenus

1. **Abonnements Pro** : plus de 90 % des revenus visés.
2. **Licence à vie** : trésorerie de lancement, limitée dans le temps pour ne pas cannibaliser l'abonnement.
3. **Programmes de coachs** (phase 2) : programmes payants à l'unité ou inclus dans Pro, avec un partage des revenus (par exemple 50/50) avec le coach. Le coach apporte son audience, Foundry l'outil.
4. **Offre coachs / salles** (phase 3) : tableau de bord multi-clients, environ 15 à 30 € par mois et par coach.
5. **Pas de publicité, pas de revente de données.** C'est un engagement de marque, cohérent avec des données de santé.

## 6. Structure de coûts

### 6.1 Coûts fixes (hypothèses)

| Poste | Bêta | Lancement | Commentaire |
|---|---|---|---|
| Supabase | 0 € | ~25 € / mois | Offre payante nécessaire au lancement (pas de mise en pause, sauvegardes) |
| Hébergement de l'app | 0 € | 0 € | GitHub Pages ou équivalent |
| Domaine | — | ~12 € / an | |
| Service d'e-mails | 0 € | 0–20 € / mois | Gratuit jusqu'à quelques milliers d'e-mails par mois |
| Compte Apple Developer | — | ~99 € / an | |
| Compte Google Play | — | ~25 € une fois | |
| Gestion des abonnements (RevenueCat ou équivalent) | 0 € | 0 € puis ~1 % | Gratuit sous un seuil de revenus |
| Juridique (relecture des CGU et de la politique de confidentialité) | — | 500–1 500 € une fois | |
| **Total** | **≈ 0 €** | **≈ 50 € / mois + ~2 000 € de démarrage** | |

### 6.2 Coûts variables
- **Commission des stores** : 15 % (programmes petits développeurs, sous 1 M$ de revenus par an).
- **TVA** : 20 % en France, prélevée par les stores sur le prix TTC.
- **IA photo** (futur) : environ 0,5 à 2 centimes par photo. Réservée à Pro et plafonnée par mois.

### 6.3 Ce que rapporte un abonné annuel
39,99 € TTC → 33,33 € HT → **≈ 28,30 € net** après la commission de 15 %.

## 7. Indicateurs clés

| Indicateur | Cible à 12 mois | Pourquoi |
|---|---|---|
| Rétention J30 (utilisateurs actifs) | ≥ 25 % | Le gratuit doit devenir une habitude |
| Séances notées par utilisateur actif et par semaine | ≥ 2,5 | Signe de valeur réelle |
| Conversion gratuit → Pro | 3–5 % | Standard des apps fitness freemium |
| Part de l'annuel dans les abonnements | ≥ 60 % | Rétention et trésorerie |
| Résiliation mensuelle Pro | ≤ 6 % | |
| Invitations acceptées par utilisateur | ≥ 0,3 | Moteur de croissance gratuite |
| Coût d'acquisition payante (CAC) | < 15 € par abonné | Rentabilité de la publicité |

## 8. Projection simple (hypothèses)

Hypothèses : conversion de 4 % des utilisateurs actifs, revenu net moyen de 2,50 € par abonné et par mois (mélange mensuel / annuel, après stores et TVA), coûts fixes de 60 € par mois.

| Utilisateurs actifs par mois | Abonnés Pro | Revenu net / mois | Coûts fixes / mois | Résultat / mois |
|---|---|---|---|---|
| 500 | 20 | 50 € | 60 € | −10 € |
| 2 000 | 80 | 200 € | 60 € | +140 € |
| 10 000 | 400 | 1 000 € | 100 € | +900 € |
| 50 000 | 2 000 | 5 000 € | 400 € | +4 600 € |

**Point mort** : environ 600 utilisateurs actifs, soit quelques dizaines d'abonnés. Le modèle est rentable très tôt parce que les coûts fixes sont faibles. L'enjeu n'est donc pas la rentabilité mais la **croissance**.

*Hors temps de développement et marketing payant. Une campagne publicitaire ne se justifie que si un abonné rapporte au moins trois fois son coût d'acquisition.*

## 9. Acquisition (go-to-market)

### Phase 0 — Bêta privée (maintenant → +2 mois)
- 20 à 50 testeurs (amis, salle), accès Pro offert.
- Objectif : rétention, retours, corrections, premiers témoignages.

### Phase 1 — Lancement France (+2 → +6 mois)
- Publication sur l'App Store et Google Play, fiche store soignée (captures, mots-clés « musculation », « macros », « calories », « programme »).
- **Contenu court** (TikTok, Instagram, YouTube Shorts) : la construction de l'app racontée publiquement, ses propres séances, des démonstrations « ce que mange un pratiquant en sèche, avec ses macros ».
- **Micro-influenceurs** fitness francophones (10 k à 100 k abonnés) : code d'essai prolongé et commission sur les abonnements.
- **Partenariats salles de sport** : affiche avec QR code, classement de la salle.
- **Boucle virale intégrée** : invitations, classements, face-à-face, repas partagés.

### Phase 2 — Élargissement (+6 → +18 mois)
- Programmes de coachs partenaires (contenu exclusif et audience).
- Ouverture à l'anglais et aux pays francophones (Belgique, Suisse, Canada, Maghreb).
- Offre coachs / salles.

## 10. Avantages durables

1. **Les données de l'utilisateur** : plus il note, plus l'estimation de sa dépense et ses analyses sont justes. Partir, c'est perdre cet historique (l'export reste possible : on retient par la valeur, pas par l'enfermement).
2. **Le réseau d'amis** : les classements n'ont d'intérêt qu'avec ses amis dans l'app.
3. **La base commune** d'aliments et de repas français, qui s'enrichit avec les membres.
4. **Le positionnement unique** entraînement + nutrition adaptative, en français, à un prix accessible.

## 11. Risques et réponses

| Risque | Réponse |
|---|---|
| Les grandes apps ajoutent la partie qui leur manque | Aller vite sur le lien diète × force et le social ; marque et communauté françaises |
| Conversion trop faible | Tester ce qui est gratuit ou payant, l'essai, les prix ; montrer la valeur Pro pendant l'essai |
| Données de santé et RGPD | Consentement explicite, hébergement européen, relecture juridique, pas de revente |
| Contenu communautaire inapproprié ou faux | Signalement, modération, valeurs nutritionnelles bornées |
| Dépendance aux stores (commission, refus) | Garder la version web, respecter les règles (pas de nom de célébrité sans accord) |
| Fondateur seul | Prioriser, automatiser, s'appuyer sur les testeurs et les coachs partenaires |

## 12. Prochaines étapes concrètes

1. Statut juridique (micro-entreprise), comptes Apple et Google, domaine.
2. App native (Capacitor) avec notifications.
3. Page d'abonnement et achats intégrés (RevenueCat), interrupteur Pro activé.
4. Textes légaux complétés et relus.
5. Bêta privée sur TestFlight, mesure de la rétention et de la conversion.
6. Lancement France et premiers partenariats avec des créateurs.
