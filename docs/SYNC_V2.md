# Synchronisation v2 — conception (lot 3)

*Document à valider avant tout code (plan de correction, lot 3). Novembre 2026.*

## 1. Aujourd'hui

- **Sur l'appareil** : tout l'état (`State`) est un seul JSON dans `localStorage` (`foundry:v1`),
  réécrit en entier (`JSON.stringify`) à **chaque** modification, même une série cochée.
- **Sur le compte** : une ligne `user_state` par compte, avec tout l'état dans une colonne `data`,
  renvoyée en entier à chaque synchronisation. Écriture conditionnelle sur `updated_at`
  (posé par le téléphone), fusion élément par élément avec pierres tombales en cas de conflit
  (`cloud/merge.ts`, testé).
- **Mesures** sur le jeu de test réaliste : environ 1,3 ko par séance, 0,2 ko par aliment noté.
  Utilisateur assidu (5 séances et ~15 aliments par jour) : **~1,5 Mo par an**. Limite de
  `localStorage` ≈ 5 Mo : **atteinte en 3 ans environ**, et chaque modification renvoie déjà
  plusieurs centaines de ko au serveur après un an.
- L'heure de référence (`updated_at`) vient de l'horloge du téléphone (point 1.8 reporté ici).

## 2. Objectifs (critères de fin du lot)

Avec un jeu de données **fictif de cinq ans** (≈ 1 300 séances, 25 000 aliments, 1 800 pesées) :

1. Démarrage de l'app **sous une seconde** sur un téléphone moyen (mesuré avec CPU ralenti ×4).
2. Valider une série **sans blocage perceptible** (écriture locale < 16 ms sur le fil principal).
3. **Moins de 10 ko envoyés** par modification.
4. Aucune perte de données pendant et après la migration ; **retour arrière possible 30 jours**.
5. L'heure de référence de la synchro est **posée par le serveur**.

## 3. Conception

### 3.1 Stockage local : IndexedDB

- Base `foundry`, deux magasins :
  - `items` : une entrée par élément, clé `[kind, id]` (`kind` = `workout`, `routine`, `folder`,
    `exercise`, `food`, `log`, `meal`, `weight`, `checkin`, `favorite`, `incomplete`), valeur = l'élément.
  - `docs` : les objets uniques (`settings`, `profile`, `goals`, `nutritionPlan` (profil et réglages
    nutrition), `active` (séance en cours), `rest`, `deleted`).
- **Écriture par différence** : `update()` compare l'état avant/après **par référence** (l'état est
  immuable, donc un élément inchangé garde la même référence) et n'écrit que les éléments ajoutés,
  modifiés ou supprimés, regroupés et différés (~300 ms, ou à la mise en arrière-plan de l'app).
  Cocher une série écrit une seule séance (≈ 1 ko), pas 1,5 Mo.
- **Lecture au démarrage** : `getAll` des deux magasins, puis reconstruction de `State`. Le reste de
  l'app ne change pas (même forme d'état, mêmes écrans).
- **Repli** : si IndexedDB est indisponible (navigation privée sur certains navigateurs), l'app garde
  le fonctionnement actuel en `localStorage`.
- **Migration locale** automatique au premier lancement : copie de `foundry:v1` vers IndexedDB ; la clé
  `localStorage` est gardée **en lecture seule 30 jours** (date notée), puis effacée.
- Petit module maison (`src/db.ts`, ~100 lignes), sans nouvelle dépendance.

### 3.2 Synchronisation par élément

**Nouvelle table** `public.user_items` :

| Colonne | Rôle |
|---|---|
| `user_id` | propriétaire (RLS : chacun ne voit et n'écrit que ses lignes) |
| `kind`, `id` | même découpage que localement ; clé primaire `(user_id, kind, id)` |
| `data` | l'élément (JSON), borné en taille |
| `deleted` | pierre tombale |
| `updated_at` | **posé par le serveur** (déclencheur `clock_timestamp()`), jamais par le client |

Index `(user_id, updated_at)`. Déclencheur d'immuabilité des colonnes d'identité, comme au lot 1.

**Envoi** : une « boîte d'envoi » locale liste les clés modifiées depuis le dernier envoi
(alimentée par la même différence qu'en 3.1). Envoi par lots de 200 lignes maximum (`upsert`), qui
renvoie les `updated_at` du serveur.

**Réception** : chaque appareil garde un **curseur** = le plus grand `updated_at` serveur déjà reçu.
`select … where updated_at > curseur order by updated_at limit 1000`, page par page. Au premier
lancement sur un nouvel appareil, tout est téléchargé une fois.

**Conflits** : pour un même élément modifié sur deux appareils, la dernière écriture reçue par le
serveur l'emporte (horloge serveur). C'est déjà la règle actuelle pour un même élément ; les éléments
différents ne se gênent jamais. Les objets uniques sont découpés (`settings`, `profile`, `goals`…)
pour limiter les conflits. La séance en cours garde la règle actuelle (une séance terminée ailleurs
n'est pas reprise).

**Suppressions** : ligne `deleted = true`, données vidées. Purge des pierres tombales de plus de
180 jours par `admin.purge_expired()` (même durée qu'aujourd'hui).

**Quand** : comme aujourd'hui (à l'ouverture, au retour en ligne, après une modification, à la
demande), plus léger ; le temps réel entre appareils pourra venir ensuite (Realtime sur `user_items`).

**Taille** : une séance ≈ 1,3 ko, un aliment ≈ 0,2 ko → **une modification < 10 ko**.

### 3.3 Migration du compte

1. Au premier lancement de la v2, si le compte n'a aucune ligne `user_items` : l'app **éclate** le bloc
   `user_state` en lignes (par lots), puis écrit une ligne `kind = 'meta', id = 'migrated'`.
   Idempotent : relancée après une coupure, elle reprend sans doublon (`upsert` sur la clé).
2. Le bloc `user_state` est **gelé** : un déclencheur refuse toute écriture une fois la ligne
   `migrated` présente. Une ancienne version de l'app restée ouverte ailleurs obtient une erreur de
   synchro et affiche le bandeau « mise à jour disponible » ; elle ne peut pas écraser les données.
3. **Retour arrière (30 jours)** : une fonction `admin.fold_items(user_id)` reconstruit le bloc
   `user_state` à partir des lignes (inverse exact de l'éclatement, testé). Procédure : redéployer
   l'ancienne version, lancer la fonction pour tous les comptes, supprimer le déclencheur de gel.
4. Après 30 jours sans retour arrière : `user_state` est vidé (fichier SQL séparé, lancé à la main).

### 3.4 Calculs mémorisés

`computePRs`, `expenditureSeries`, les tendances de poids et les agrégats de stats sont recalculés à
chaque rendu de plusieurs écrans. Ils seront mémorisés par identité des listes (`WeakMap` sur le
tableau `workouts` / `log`) : un même tableau ne se recalcule qu'une fois, quel que soit l'écran.

### 3.5 Droits Pro côté serveur

Table `public.entitlements (user_id, plan, source, expires_at, updated_at)`, **lisible par son
propriétaire, modifiable uniquement par le rôle de service** (futurs achats in-app, lot 6).
`hasPro()` la lit (mise en cache locale) ; l'interrupteur bêta (`PRO_FREE_DURING_BETA`) reste
prioritaire. Rien n'est vendu à ce stade.

## 4. Tests

- **Unitaires** : différence avant/après (quels éléments écrire), boîte d'envoi, application d'un lot
  reçu, curseur, conflits (horloge serveur), aller-retour **éclatement → reconstruction** identique
  sur le jeu réaliste et sur le jeu fictif de cinq ans (générateur `scripts/fake-years.ts`).
- **Banc RLS** : `user_items` et `entitlements` (un autre compte ne lit ni n'écrit, colonnes
  d'identité figées, `updated_at` imposé par le serveur, `user_state` gelé après migration,
  `entitlements` non modifiable par un membre).
- **Performance** (Playwright, CPU ×4, jeu de cinq ans) : temps de démarrage, durée d'écriture locale
  après une série cochée, octets envoyés par modification. Les seuils de la section 2 font échouer le
  script s'ils sont dépassés.
- **Bout en bout** : deux appareils simulés, modifications croisées hors ligne puis synchro, suppression
  sur l'un, migration depuis un compte v1, retour arrière.

## 5. Livraison (commits)

1. `db.ts` + migration `localStorage` → IndexedDB, écriture par différence (sans changer la synchro).
2. Calculs mémorisés (3.4).
3. SQL `user_items` (+ RLS, déclencheurs) et `entitlements`, banc RLS.
4. Moteur de synchro par élément (boîte d'envoi, curseur, réception), **désactivé par défaut** derrière
   un interrupteur par compte.
5. Migration du compte + gel de `user_state` + `admin.fold_items` (retour arrière).
6. Activation : d'abord sur ton compte, puis pour tous.
7. Script de performance et tests de bout en bout.

Chaque commit garde l'app fonctionnelle ; la synchro v1 reste en place jusqu'à l'étape 6.

## 6. Risques

| Risque | Mesure |
|---|---|
| Perte de données pendant la migration | Éclatement idempotent, bloc v1 gelé mais conservé 30 jours, reconstruction testée |
| Ancienne version de l'app qui écrit encore le bloc | Gel par déclencheur + bandeau de mise à jour |
| IndexedDB évincé par le navigateur | `navigator.storage.persist()` (déjà demandé) ; le compte reste la source de vérité |
| Safari et IndexedDB (bugs historiques) | Repli `localStorage`, tests sur WebKit (Playwright) |
| Conflit sur un même élément | Règle inchangée (dernier écrit l'emporte), désormais avec l'horloge serveur |

## 7. Décisions à valider

1. **Module IndexedDB maison** (pas de nouvelle dépendance) — proposé : oui.
2. **Ancienne version de l'app bloquée** après la migration du compte (bandeau de mise à jour) —
   acceptable pendant la bêta ?
3. **Temps réel entre appareils** (une modification apparaît sur l'autre téléphone sans action) :
   après le lot, pas dedans — proposé.
4. **Activation progressive** : ton compte d'abord, une semaine, puis tous — proposé.
