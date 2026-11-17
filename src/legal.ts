/**
 * Legal texts, in French and English: legal notice, privacy policy, terms of use, community rules,
 * sources and licences, and a draft of the sales terms (not shown until something is sold).
 * The publisher's identity comes from legalConfig.ts. Drafted without a lawyer: have them reviewed
 * before a paid launch. Bump LEGAL_VERSION when the substance changes, so everyone accepts again.
 */
import { getLang } from './i18n';
import { LEGAL, LEGAL_DRAFT, type LegalField } from './legalConfig';

export const LEGAL_VERSION = '2026-11-v4';
/** Version of the health-data consent text (asked separately, when nutrition is first used). */
export const HEALTH_CONSENT_VERSION = '2026-11-v1';
export { LEGAL_DRAFT };

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}

export type LegalKind = 'notice' | 'privacy' | 'terms' | 'community' | 'sources' | 'sales';

const fr = () => getLang() === 'fr';
/** A field of the publisher's identity, or a visible placeholder while it is empty. */
const v = (k: LegalField) => LEGAL[k].trim() || (fr() ? '[à compléter]' : '[to be completed]');
const updated = () =>
  (fr() ? 'Mise à jour : novembre 2026' : 'Last updated: November 2026') + (LEGAL_DRAFT ? (fr() ? ' · version bêta' : ' · beta version') : '');

/* ---------- Legal notice ---------- */

const notice = (): LegalDoc =>
  fr()
    ? {
        title: 'Mentions légales',
        updated: updated(),
        sections: [
          {
            h: 'Éditeur',
            p: [`${v('publisher')}, ${v('status')}.`, `SIREN : ${v('siren')}.`, `Adresse : ${v('address')}.`, `Contact : ${v('contactEmail')}.`],
          },
          { h: 'Directeur de la publication', p: [v('publicationDirector')] },
          {
            h: 'Hébergement',
            p: [`Application : ${v('appHost')}.`, `Données des comptes : ${v('dataHost')}, sur des serveurs situés en ${v('dataRegion')}.`],
          },
        ],
      }
    : {
        title: 'Legal notice',
        updated: updated(),
        sections: [
          {
            h: 'Publisher',
            p: [`${v('publisher')}, ${v('status')}.`, `Company number: ${v('siren')}.`, `Address: ${v('address')}.`, `Contact: ${v('contactEmail')}.`],
          },
          { h: 'Publication director', p: [v('publicationDirector')] },
          {
            h: 'Hosting',
            p: [`App: ${v('appHost')}.`, `Account data: ${v('dataHost')}, on servers located in ${v('dataRegion')}.`],
          },
        ],
      };

/* ---------- Privacy policy ---------- */

const privacy = (): LegalDoc =>
  fr()
    ? {
        title: 'Politique de confidentialité',
        updated: updated(),
        sections: [
          {
            h: 'Qui est responsable',
            p: [`${v('publisher')} (voir Mentions légales) est responsable du traitement de tes données. Contact : ${v('contactEmail')}.`],
          },
          {
            h: 'Les données traitées',
            p: [
              'Compte : adresse e-mail et mot de passe (conservé sous forme chiffrée par notre prestataire d’authentification, jamais lisible par nous).',
              'Entraînement : séances, séries, exercices perso (et leurs photos si tu en ajoutes), records, objectifs.',
              'Nutrition et corps (données de santé) : aliments et repas notés (et les photos que tu y ajoutes), pesées, et pour calculer tes objectifs ton sexe, ton année de naissance, ta taille et ton niveau d’activité.',
              'Profil et vie sociale : pseudo, nom affiché, photo, bio, équipement, liste d’amis, publications du fil, Respect et commentaires, repas et aliments que tu partages, signalements que tu envoies.',
              'Messages envoyés depuis « Nous contacter », avec ton adresse e-mail pour te répondre.',
              'Réglages de l’app (unités, langue, thème…).',
            ],
          },
          {
            h: 'Pourquoi et sur quelle base',
            p: [
              'Faire fonctionner le service (compte, synchronisation entre tes appareils, statistiques, fonctions sociales) : exécution du contrat que tu acceptes avec les conditions d’utilisation.',
              'Données de santé (poids, mesures, alimentation) : ton consentement explicite, demandé à part la première fois que tu utilises la nutrition ou la pesée. Tu peux le retirer à tout moment (voir plus bas).',
              'Sécurité, prévention des abus et statistiques d’usage agrégées (nombre de comptes actifs, fonctions utilisées) : notre intérêt légitime à faire fonctionner et améliorer l’app. Ces statistiques sont des comptages : elles ne contiennent ni poids, ni calories, ni contenu de tes séances.',
              'Pas de publicité, pas de revente, pas de profilage marketing.',
            ],
          },
          {
            h: 'Qui voit quoi',
            p: [
              'Tes données d’entraînement et de nutrition détaillées ne sont visibles que par toi.',
              'Tes amis acceptés voient : ton pseudo, ton nom, ta photo, ton niveau et tes badges, un résumé chiffré de ton entraînement (jours, séries, volume, cardio, records, meilleures charges estimées, défis), et les publications de ton fil (résumé de séance, nouveau niveau, nouveau badge), ainsi que ta liste d’amis (désactivable dans Réglages → Amis : « Montrer mes amis à mes amis »). Sur la page d’un autre membre, tu vois seulement les amis que vous avez en commun. Jamais ta nutrition ni ton poids, sauf les photos que tu ajoutes à tes repas enregistrés.',
              'Tous les membres voient : les repas et aliments que tu choisis de partager (avec ton nom et la photo du repas), et ta page de profil si tu la rends publique. Les photos d’exercices et d’aliments ne sont visibles que par toi.',
              'Tout se désactive dans Réglages → Amis : partage des stats, profil public ; un repas se partage ou non depuis sa page.',
            ],
          },
          {
            h: 'Sous-traitants et transferts',
            p: [
              `Supabase (base de données et authentification), serveurs en ${v('dataRegion')}.`,
              `${v('appHost')} : hébergement des pages de l’app, avec des journaux techniques (dont l’adresse IP).`,
              'Open Food Facts (association, France) : reçoit les mots recherchés et les codes-barres scannés, sans ton e-mail ni lien avec ton compte.',
              'jsDelivr et GitHub : servent les photos d’exercices et voient l’adresse IP technique de la requête.',
              'Certains de ces prestataires sont établis hors de l’Union européenne (États-Unis notamment) ; les transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou le cadre de protection des données UE–États-Unis.',
            ],
          },
          {
            h: 'Durées de conservation',
            p: [
              'Tant que ton compte est actif.',
              'Compte inactif depuis 24 mois : e-mail d’avertissement, puis suppression 30 jours plus tard sans réponse.',
              'Messages de contact et signalements : 12 mois.',
              'À la suppression du compte, tout est effacé immédiatement de la base ; les sauvegardes de l’hébergeur sont purgées selon son cycle. Les aliments ajoutés à la base commune restent, sans lien avec toi.',
            ],
          },
          {
            h: 'Tes droits',
            p: [
              'Accès et portabilité : Réglages → Exporter et importer les données (tes données, y compris les données sociales).',
              'Rectification : directement dans l’app.',
              'Effacement : Réglages → Compte → Supprimer le compte.',
              'Retrait du consentement santé : Réglages → Confidentialité, ce qui efface tes données de nutrition et de poids (l’entraînement reste).',
              `Opposition, limitation, toute autre question : ${v('contactEmail')}. Réponse sous un mois. Tu peux aussi saisir la CNIL (cnil.fr).`,
            ],
          },
          {
            h: 'Estimations, pas de décision automatisée',
            p: [
              'Les objectifs et la dépense calculés par l’app sont des estimations que tu peux modifier à tout moment. Aucune décision produisant un effet juridique n’est prise de façon automatisée.',
            ],
          },
          { h: 'Âge minimum', p: ['Foundry est réservé aux personnes de 16 ans ou plus. Les objectifs de perte de poids sont réservés aux 18 ans et plus.'] },
          { h: 'Modifications', p: ['Si cette politique change de façon importante, l’app te le signale et te demande de l’accepter à nouveau.'] },
        ],
      }
    : {
        title: 'Privacy policy',
        updated: updated(),
        sections: [
          { h: 'Who is responsible', p: [`${v('publisher')} (see Legal notice) is the controller of your data. Contact: ${v('contactEmail')}.`] },
          {
            h: 'The data we process',
            p: [
              'Account: email address and password (kept encrypted by our authentication provider, never readable by us).',
              'Training: workouts, sets, custom exercises (and their photos, if you add any), records, goals.',
              'Nutrition and body (health data): foods and meals you log (and the photos you add to them), weigh-ins, and to compute your targets your sex, birth year, height and activity level.',
              'Profile and social: username, display name, picture, bio, gear, friend list, feed posts, Respect and comments, meals and foods you share, reports you send.',
              'Messages sent from "Contact us", with your email address so we can reply.',
              'App settings (units, language, theme…).',
            ],
          },
          {
            h: 'Why, and on what basis',
            p: [
              'Running the service (account, sync across your devices, statistics, social features): performance of the contract you accept with the terms of use.',
              'Health data (weight, measurements, food intake): your explicit consent, asked separately the first time you use nutrition or weigh-ins. You can withdraw it at any time (see below).',
              'Security, abuse prevention and aggregated usage statistics (number of active accounts, features used): our legitimate interest in running and improving the app. These statistics are counts: they contain no weight, calories or workout content.',
              'No advertising, no selling, no marketing profiling.',
            ],
          },
          {
            h: 'Who sees what',
            p: [
              'Your detailed training and nutrition data is visible to you only.',
              'Accepted friends see: your username, name, picture, level and badges, a numeric summary of your training (days, sets, volume, cardio, records, estimated best lifts, challenges), and your feed posts (workout summary, new level, new badge), and your friend list (can be turned off in Settings → Friends: “Show my friends to my friends”). On another member’s page you only see the friends you have in common. Never your nutrition or weight, except the photos you add to your saved meals.',
              'All members see: the meals and foods you choose to share (with your name and the meal’s photo), and your profile page if you make it public. Photos of exercises and foods stay visible to you only.',
              'Everything can be turned off in Settings → Friends: shared stats, public profile; each meal is shared or not from its page.',
            ],
          },
          {
            h: 'Processors and transfers',
            p: [
              `Supabase (database and authentication), servers in ${v('dataRegion')}.`,
              `${v('appHost')}: hosting of the app's pages, with technical logs (including the IP address).`,
              'Open Food Facts (non-profit, France): receives the words you search and the barcodes you scan, without your email or any link to your account.',
              'jsDelivr and GitHub: serve the exercise photos and see the technical IP address of the request.',
              'Some of these providers are based outside the European Union (notably in the United States); transfers rely on the European Commission’s standard contractual clauses or the EU–US Data Privacy Framework.',
            ],
          },
          {
            h: 'How long we keep it',
            p: [
              'As long as your account is active.',
              'Account inactive for 24 months: a warning email, then deletion 30 days later without an answer.',
              'Contact messages and reports: 12 months.',
              'When you delete your account, everything is erased from the database at once; the host’s backups are purged on its own schedule. Foods added to the shared database stay, with no link to you.',
            ],
          },
          {
            h: 'Your rights',
            p: [
              'Access and portability: Settings → Export & import data (your data, social data included).',
              'Rectification: directly in the app.',
              'Erasure: Settings → Account → Delete account.',
              'Withdrawing the health consent: Settings → Privacy, which erases your nutrition and weight data (training stays).',
              `Objection, restriction, any other question: ${v('contactEmail')}. We answer within one month. You can also complain to your data protection authority (in France, the CNIL, cnil.fr).`,
            ],
          },
          {
            h: 'Estimates, no automated decisions',
            p: [
              'The targets and expenditure the app computes are estimates you can change at any time. No decision with a legal effect is taken automatically.',
            ],
          },
          { h: 'Minimum age', p: ['Foundry is for people aged 16 or over. Weight-loss goals are for people aged 18 or over.'] },
          { h: 'Changes', p: ['If this policy changes in a significant way, the app tells you and asks you to accept it again.'] },
        ],
      };

/* ---------- Terms of use ---------- */

const terms = (): LegalDoc =>
  fr()
    ? {
        title: 'Conditions d’utilisation',
        updated: updated(),
        sections: [
          {
            h: 'Le service',
            p: [
              `Foundry est une app de suivi d’entraînement et de nutrition éditée par ${v('publisher')}. Pendant la bêta, elle est gratuite et peut évoluer, être interrompue ou contenir des erreurs.`,
            ],
          },
          {
            h: 'Ton compte',
            p: [
              'Tu dois avoir 16 ans ou plus. Un compte est personnel. Tu es responsable de la confidentialité de ton mot de passe et des informations que tu saisis.',
            ],
          },
          {
            h: 'Pas un avis médical',
            p: [
              'Foundry fournit des estimations (dépense énergétique, objectifs adaptatifs de calories et de macros, 1RM, tendances) pour des adultes en bonne santé. Ce n’est ni un dispositif médical, ni un avis médical ou diététique, ni un suivi par un professionnel.',
              'Demande l’avis d’un professionnel de santé avant de changer ton alimentation ou ton entraînement, en particulier en cas de grossesse, de maladie, d’antécédent de trouble alimentaire ou de traitement. Arrête un exercice en cas de douleur.',
              'L’app ne propose pas d’objectif de perte de poids aux moins de 18 ans ni si ton indice de masse corporelle est inférieur à 18,5, limite le rythme de perte à 1 % du poids par semaine et ne descend jamais sous 1 200 kcal (femmes) ou 1 500 kcal (hommes) par jour. Ces garde-fous ne remplacent pas un suivi médical.',
            ],
          },
          {
            h: 'Données de tiers',
            p: [
              'Les valeurs nutritionnelles viennent de bases publiques et de contributions de membres : elles peuvent contenir des erreurs. Vérifie l’étiquette quand c’est important.',
            ],
          },
          {
            h: 'Contenus des membres',
            p: [
              'Tu restes propriétaire de ce que tu partages (repas, aliments, commentaires, photo, profil). En le partageant, tu autorises l’éditeur à l’afficher aux autres membres dans l’app, pour la durée du partage.',
              'Tu t’engages à respecter les Règles de la communauté. Tout membre peut signaler un contenu ; l’éditeur peut retirer un contenu ou suspendre un compte qui ne les respecte pas, et tu peux contester cette décision en écrivant au contact.',
              'Les aliments ajoutés à la base commune restent disponibles pour tous, sans lien avec toi, même après la suppression de ton compte.',
            ],
          },
          {
            h: 'Tes données',
            p: [
              'Tes données t’appartiennent : exporte-les ou supprime ton compte à tout moment. Leur traitement est décrit dans la Politique de confidentialité.',
            ],
          },
          {
            h: 'Utilisation correcte',
            p: [
              'N’utilise pas l’app pour nuire à son fonctionnement, accéder aux données d’autrui, contourner ses protections ou fausser les classements. Un compte qui le fait peut être suspendu.',
            ],
          },
          {
            h: 'Propriété intellectuelle',
            p: [
              'Le nom Foundry, le logo, le design, les textes et le code appartiennent à l’éditeur. Les données et éléments de tiers sont listés dans Sources et licences.',
            ],
          },
          {
            h: 'Responsabilité',
            p: [
              'L’app est fournie en l’état. Dans les limites permises par la loi, l’éditeur n’est pas responsable des conséquences de l’usage des estimations ni d’une perte de données ; garde des sauvegardes si tes données comptent pour toi.',
            ],
          },
          {
            h: 'Modifications et droit applicable',
            p: [
              'Ces conditions peuvent évoluer ; l’app te demande de les accepter à nouveau après un changement important. Elles sont régies par le droit français ; en cas de litige, une solution amiable est recherchée avant toute action.',
            ],
          },
        ],
      }
    : {
        title: 'Terms of use',
        updated: updated(),
        sections: [
          {
            h: 'The service',
            p: [
              `Foundry is a training and nutrition tracking app published by ${v('publisher')}. During the beta it is free and may change, be interrupted or contain errors.`,
            ],
          },
          {
            h: 'Your account',
            p: ['You must be 16 or over. An account is personal. You are responsible for keeping your password private and for what you enter.'],
          },
          {
            h: 'Not medical advice',
            p: [
              'Foundry gives estimates (energy expenditure, adaptive calorie and macro targets, 1RM, trends) for healthy adults. It is not a medical device, nor medical or dietary advice, nor follow-up by a professional.',
              'Ask a health professional before changing your diet or training, especially if you are pregnant, ill, have a history of eating disorders or take medication. Stop an exercise if it hurts.',
              'The app does not offer weight-loss goals to people under 18 or with a body mass index below 18.5, caps the loss rate at 1% of body weight per week and never goes below 1,200 kcal (women) or 1,500 kcal (men) a day. These safeguards do not replace medical care.',
            ],
          },
          {
            h: 'Third-party data',
            p: ['Nutrition values come from public databases and member contributions: they may contain errors. Check the label when it matters.'],
          },
          {
            h: 'Member content',
            p: [
              'You keep ownership of what you share (meals, foods, comments, picture, profile). By sharing it, you allow the publisher to show it to other members in the app, for as long as it is shared.',
              'You agree to follow the Community rules. Any member can report content; the publisher may remove content or suspend an account that breaks them, and you can contest that decision by writing to the contact address.',
              'Foods added to the shared database stay available to everyone, with no link to you, even after your account is deleted.',
            ],
          },
          { h: 'Your data', p: ['Your data is yours: export it or delete your account at any time. How it is processed is described in the Privacy policy.'] },
          {
            h: 'Fair use',
            p: [
              'Do not use the app to disrupt it, access other people’s data, get around its protections or game the leaderboards. An account doing so may be suspended.',
            ],
          },
          {
            h: 'Intellectual property',
            p: ['The Foundry name, logo, design, texts and code belong to the publisher. Third-party data and assets are listed in Sources and licences.'],
          },
          {
            h: 'Liability',
            p: [
              'The app is provided as is. To the extent the law allows, the publisher is not liable for the consequences of using the estimates or for data loss; keep backups if your data matters to you.',
            ],
          },
          {
            h: 'Changes and governing law',
            p: [
              'These terms may change; the app asks you to accept them again after a significant change. They are governed by French law; in a dispute, an amicable solution is sought first.',
            ],
          },
        ],
      };

/* ---------- Community rules ---------- */

const community = (): LegalDoc =>
  fr()
    ? {
        title: 'Règles de la communauté',
        updated: updated(),
        sections: [
          { h: 'Ce qu’on partage', p: ['Des repas, des aliments avec leurs vraies valeurs, des commentaires d’encouragement, un profil qui te ressemble.'] },
          {
            h: 'Ce qui est retiré',
            p: [
              'Les valeurs nutritionnelles volontairement fausses ; la publicité et le spam.',
              'Les propos insultants, haineux, discriminants ou harcelants ; les contenus sexuels ou violents.',
              'Le fait de se faire passer pour quelqu’un d’autre ; les contenus qui encouragent des comportements dangereux pour la santé (jeûnes extrêmes, produits dopants…).',
            ],
          },
          {
            h: 'Signaler',
            p: ['Touche « Signaler » sur un aliment, un repas, un commentaire ou un profil. Le contenu disparaît pour toi tout de suite ; l’équipe l’examine.'],
          },
          {
            h: 'Contester',
            p: [`Si un de tes contenus a été retiré ou ton compte suspendu, écris à ${v('contactEmail')} en expliquant pourquoi : la décision est réexaminée.`],
          },
        ],
      }
    : {
        title: 'Community rules',
        updated: updated(),
        sections: [
          { h: 'What to share', p: ['Meals, foods with their real values, encouraging comments, a profile that looks like you.'] },
          {
            h: 'What gets removed',
            p: [
              'Deliberately wrong nutrition values; advertising and spam.',
              'Insulting, hateful, discriminatory or harassing words; sexual or violent content.',
              'Pretending to be someone else; content that encourages behaviour dangerous to health (extreme fasting, doping products…).',
            ],
          },
          { h: 'Report', p: ['Tap “Report” on a food, a meal, a comment or a profile. It disappears for you at once; the team looks at it.'] },
          {
            h: 'Contest',
            p: [
              `If something you shared was removed or your account suspended, write to ${v('contactEmail')} and explain why: the decision is looked at again.`,
            ],
          },
        ],
      };

/* ---------- Sources and licences ---------- */

const sources = (): LegalDoc =>
  fr()
    ? {
        title: 'Sources et licences',
        updated: updated(),
        sections: [
          {
            h: 'Données',
            p: [
              'Marques et codes-barres : Open Food Facts (openfoodfacts.org), base sous licence Open Database License (ODbL), contenus sous Database Contents License. Les produits Open Food Facts ne sont jamais recopiés dans la base commune de Foundry.',
              'Aliments de base : USDA FoodData Central (domaine public), via le jeu de données TempoLife (tempolife.app, licence CC-BY 4.0).',
              'Photos et noms d’exercices : Free Exercise DB (github.com/yuhonas/free-exercise-db), domaine public (Unlicense).',
            ],
          },
          { h: 'Polices', p: ['Archivo et IBM Plex Sans, licence SIL Open Font License 1.1.'] },
          { h: 'Logiciels', p: ['React (MIT), Supabase JS (MIT), ZXing (Apache 2.0), Vite (MIT) et leurs dépendances, chacune sous sa propre licence.'] },
          {
            h: 'Marques citées',
            p: [
              'Hevy est une marque de son propriétaire, citée uniquement pour décrire le format de fichier que Foundry sait importer. Foundry n’est affilié à aucune marque citée.',
            ],
          },
        ],
      }
    : {
        title: 'Sources and licences',
        updated: updated(),
        sections: [
          {
            h: 'Data',
            p: [
              'Brands and barcodes: Open Food Facts (openfoodfacts.org), database under the Open Database License (ODbL), contents under the Database Contents License. Open Food Facts products are never copied into Foundry’s shared database.',
              'Basic foods: USDA FoodData Central (public domain), via the TempoLife dataset (tempolife.app, CC-BY 4.0 licence).',
              'Exercise photos and names: Free Exercise DB (github.com/yuhonas/free-exercise-db), public domain (Unlicense).',
            ],
          },
          { h: 'Typefaces', p: ['Archivo and IBM Plex Sans, SIL Open Font License 1.1.'] },
          { h: 'Software', p: ['React (MIT), Supabase JS (MIT), ZXing (Apache 2.0), Vite (MIT) and their dependencies, each under its own licence.'] },
          {
            h: 'Brands mentioned',
            p: [
              'Hevy is a trademark of its owner, mentioned only to describe the file format Foundry can import. Foundry is not affiliated with any brand mentioned.',
            ],
          },
        ],
      };

/* ---------- Sales terms (draft, hidden until something is sold) ---------- */

const sales = (): LegalDoc => ({
  title: fr() ? 'Conditions de vente (brouillon)' : 'Sales terms (draft)',
  updated: updated(),
  sections: [
    {
      h: fr() ? 'À compléter avec un juriste avant toute vente' : 'To complete with a lawyer before any sale',
      p: fr()
        ? [
            'Offre, prix TTC, durée et renouvellement de l’abonnement, résiliation.',
            'Droit de rétractation de 14 jours et ses modalités pour un contenu numérique (dont la renonciation expresse si le service commence immédiatement).',
            'Garantie légale de conformité des contenus et services numériques.',
            `Médiateur de la consommation : ${v('mediator')}.`,
            'Achats via l’App Store ou Google Play : paiement, renouvellement et remboursement passent par Apple ou Google.',
          ]
        : [
            'Offer, prices including VAT, subscription length and renewal, cancellation.',
            '14-day right of withdrawal and how it applies to digital content (including the express waiver when the service starts at once).',
            'Legal guarantee of conformity for digital content and services.',
            `Consumer mediator: ${v('mediator')}.`,
            'Purchases through the App Store or Google Play: payment, renewal and refunds go through Apple or Google.',
          ],
    },
  ],
});

const DOCS: Record<LegalKind, () => LegalDoc> = { notice, privacy, terms, community, sources, sales };
export const legalDoc = (k: LegalKind) => DOCS[k]();
export const privacyPolicy = privacy;
export const termsOfUse = terms;
