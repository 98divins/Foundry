# Registre des traitements — Foundry

*Modèle pré-rempli à partir du code (novembre 2026). À compléter par le responsable du traitement
(champs entre crochets) et à tenir à jour à chaque nouvelle fonction. Obligatoire dès lors que des
données de santé sont traitées, quelle que soit la taille de la structure (RGPD, art. 30).*

**Responsable du traitement** : [nom / raison sociale, adresse, contact — voir `src/legalConfig.ts`]
**Délégué à la protection des données** : aucun désigné à ce stade (non obligatoire tant que le traitement n'est pas « à grande échelle » ; à réexaminer).

| # | Traitement | Finalité | Base légale | Personnes | Données | Destinataires | Durée | Transferts hors UE |
|---|---|---|---|---|---|---|---|---|
| 1 | Compte et authentification | Créer et sécuriser le compte | Exécution du contrat | Membres | E-mail, mot de passe chiffré, dates de connexion | Supabase (sous-traitant) | Vie du compte ; compte inactif 24 mois : avertissement puis suppression à 30 jours | Selon région Supabase [à confirmer] |
| 2 | Suivi d'entraînement | Enregistrer et synchroniser les séances, calculer statistiques, niveaux, défis | Exécution du contrat | Membres | Séances, séries, exercices perso, objectifs | Supabase | Vie du compte | Idem |
| 3 | Nutrition et corps (**données de santé**) | Journal alimentaire, poids, objectifs adaptatifs | **Consentement explicite** (art. 9.2.a), recueilli séparément, retirable (Réglages → Confidentialité) | Membres ayant consenti | Aliments, repas, pesées, sexe, année de naissance, taille, activité | Supabase | Vie du compte ou jusqu'au retrait du consentement (effacement immédiat) | Idem |
| 4 | Fonctions sociales | Amis, fil d'activité, classements, face-à-face, profil public | Exécution du contrat | Membres et leurs amis | Pseudo, nom affiché, photo, bio, équipement, résumé chiffré d'entraînement, publications, commentaires, Respect | Amis acceptés ; tous les membres pour le profil public s'il est activé | Vie du compte | Idem |
| 5 | Contenus partagés | Repas et aliments partagés avec la communauté | Exécution du contrat | Membres | Nom de l'auteur, recette, valeurs nutritionnelles | Tous les membres | Jusqu'au retrait du partage ou suppression du compte ; aliments communs conservés sans lien avec la personne | Idem |
| 6 | Modération | Traiter les signalements | Intérêt légitime (sécurité de la communauté) | Signalants, auteurs signalés | Élément signalé, motif, précisions, pseudo du signalant | Responsable du traitement | 12 mois (`admin.purge_expired()`) | Idem |
| 7 | Contact | Répondre aux messages | Intérêt légitime / mesures précontractuelles | Membres qui écrivent | E-mail, message, version de l'app, appareil | Responsable du traitement | 12 mois ; effacé à la suppression du compte | Idem |
| 8 | Statistiques d'usage | Mesurer l'adoption et améliorer l'app | Intérêt légitime | Membres | Comptages et dates uniquement (vues `admin.*`, sans e-mail, nom, poids ni calories) | Responsable du traitement | Calculées à la volée, rien n'est conservé à part | Idem |
| 9 | Recherche d'aliments | Trouver un produit | Exécution du contrat | Membres | Mots recherchés, codes-barres (sans identité) | Open Food Facts | Selon Open Food Facts | Non (France) |
| 10 | Hébergement de l'app | Servir les pages | Intérêt légitime | Visiteurs | Adresse IP, journaux techniques | GitHub (Pages), jsDelivr | Selon l'hébergeur | Oui (États-Unis) : clauses types / Data Privacy Framework [à vérifier] |

**Mesures de sécurité** : chiffrement en transit (HTTPS) ; règles d'accès par ligne (RLS) testées
automatiquement à chaque déploiement (`npm run test:rls`) ; colonnes d'identité figées ; politique de
sécurité du contenu (CSP) ; clé `service_role` jamais dans l'app ; mots de passe gérés par Supabase ;
sauvegardes [à confirmer dans Supabase].
