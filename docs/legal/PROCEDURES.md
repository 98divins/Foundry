# Procédures internes — Foundry

*Modèles à adapter par le responsable du traitement (novembre 2026).*

## 1. Demande d'exercice de droits (réponse sous un mois)

1. Noter la demande (date, personne, droit demandé) dans un suivi privé.
2. Vérifier l'identité : la demande doit venir de l'adresse e-mail du compte. Sinon, demander une
   confirmation depuis cette adresse.
3. Retrouver le compte : `select * from admin.account_for_email('…');`
4. Selon le droit :
   - **Accès / portabilité** : rappeler l'export intégré (Réglages → Exporter et importer les données,
     y compris « Exporter mes données sociales ») ou fournir l'export sous un mois.
   - **Rectification** : l'app le permet ; sinon corriger.
   - **Effacement** : l'app le permet (Réglages → Compte → Supprimer) ; sinon supprimer l'utilisateur
     dans Authentication → Users (tout est effacé en cascade).
   - **Retrait du consentement santé** : Réglages → Confidentialité.
   - **Opposition / limitation** : étudier et répondre de façon motivée.
5. Répondre par écrit, au plus tard un mois après la réception (prolongeable de deux mois si complexe,
   en prévenant la personne).

## 2. Violation de données (notification CNIL sous 72 heures)

1. **Contenir** : couper l'accès en cause (révoquer une clé, désactiver une fonction, corriger une règle).
2. **Évaluer** : quelles données, combien de personnes, quels risques (données de santé = risque élevé).
3. **Notifier la CNIL sous 72 heures** après en avoir eu connaissance (notifications.cnil.fr), même
   si l'analyse n'est pas finie (compléter ensuite).
4. **Informer les personnes** sans tarder si le risque est élevé (e-mail clair : ce qui s'est passé,
   les conséquences possibles, ce qui a été fait, ce qu'elles peuvent faire).
5. **Documenter** dans un registre des violations, même sans notification.
6. **Corriger** et ajouter un test qui empêche le retour du problème (banc RLS).

## 3. Contenu signalé

1. Chaque semaine : `select * from admin.reports;` (les plus signalés et non traités en premier).
2. Regarder l'élément (aliment, repas, commentaire, profil) au regard des Règles de la communauté.
3. Si contraire aux règles : le supprimer (Table Editor), et en cas de récidive suspendre le compte
   (Authentication → Users → Ban). Sinon, le laisser.
4. Marquer le signalement traité : `update public.content_reports set handled_at = now() where id = …;`
5. Si l'auteur conteste par e-mail : réexaminer et répondre de façon motivée.
6. Chaque mois : `select * from admin.purge_expired();` (messages et signalements de plus de 12 mois).
