# Analyse d'impact allégée (AIPD) — Foundry

*Modèle pré-rempli (novembre 2026), à relire par le responsable du traitement. Recommandée dès
maintenant (données de santé) ; devient obligatoire si le traitement passe à grande échelle.*

## 1. Description

Application de suivi d'entraînement et de nutrition. Les données de santé (poids, mesures,
alimentation) servent à estimer la dépense énergétique et à proposer des objectifs caloriques et de
macronutriments, que la personne peut modifier. Pas de décision automatisée à effet juridique.

## 2. Nécessité et proportionnalité

- **Minimisation** : seules les données utiles au calcul sont demandées (sexe, année de naissance,
  taille, activité, poids, aliments). Aucune donnée médicale (maladies, traitements).
- **Consentement** explicite et séparé pour les données de santé, retrait aussi simple que l'accord,
  qui efface les données.
- **Transparence** : politique de confidentialité, « qui voit quoi », règles de la communauté.
- **Droits** : export complet (y compris données sociales), rectification dans l'app, suppression du
  compte en un geste.
- **Durées** : voir le registre ; purge mensuelle des messages et signalements.

## 3. Risques et mesures

| Risque | Gravité | Vraisemblance | Mesures | Risque résiduel |
|---|---|---|---|---|
| Accès illégitime aux données de santé d'un membre | Importante | Faible | RLS par ligne testées en CI, faille « amitiés » corrigée et couverte par un test, données de santé jamais publiées dans les stats partagées, CSP | Faible |
| Fuite par un sous-traitant (Supabase, hébergeur) | Importante | Faible | Accord de sous-traitance [à signer], région UE [à confirmer], chiffrement en transit | Faible à modéré |
| Usage nocif des objectifs (trouble alimentaire, mineurs) | Importante | Modérée | Pas d'objectif de perte < 18 ans ni sous IMC 18,5, perte ≤ 1 %/semaine, planchers caloriques, rappel « pas un avis médical », bandeau de retour au maintien | Modéré : ressource d'aide à ajouter [à choisir] |
| Exposition sociale non voulue | Modérée | Modérée | Résumé chiffré seulement, profil privé par défaut, partage désactivable, signalement | Faible |
| Contenu faux ou malveillant partagé | Modérée | Modérée | Open Food Facts prioritaire au scan, limite 30 aliments/jour, signalement, auteur fixé par le serveur | Faible |
| Perte de données | Modérée | Faible | Synchronisation avec écriture conditionnelle, déconnexion sûre, export et sauvegardes | Faible |

## 4. Plan d'action

- [ ] Signer l'accord de sous-traitance Supabase et confirmer la région UE.
- [ ] Choisir une ressource d'aide pour les troubles alimentaires et l'ajouter aux messages de garde-fou.
- [ ] Faire confirmer par un juriste que l'hébergement n'exige pas la certification HDS (à revoir pour une offre professionnelle).
- [ ] Revoir cette analyse à chaque nouvelle donnée collectée ou nouveau destinataire.
