/**
 * Privacy policy and terms of use, in French and English.
 * DRAFT: the publisher, the contact address and the hosting region must be filled in, and the texts
 * reviewed by a lawyer, before a paid launch. Bump LEGAL_VERSION when the substance changes, so
 * every user is asked to accept again.
 */
import { getLang } from './i18n';

export const LEGAL_VERSION = '2026-11-draft';
export const LEGAL_DRAFT = true;

/** To fill in before launch. */
const PUBLISHER = { fr: '[Nom de l’éditeur]', en: '[Publisher name]' };
const CONTACT = '[contact e-mail]';
const REGION = { fr: '[région d’hébergement Supabase, à confirmer]', en: '[Supabase hosting region, to confirm]' };

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}

const privacyFr = (): LegalDoc => ({
  title: 'Politique de confidentialité',
  updated: 'Version préliminaire, novembre 2026',
  sections: [
    { h: 'Qui est responsable', p: [`Foundry est édité par ${PUBLISHER.fr}, responsable du traitement de tes données. Contact : ${CONTACT}.`] },
    {
      h: 'Les données que nous traitons',
      p: [
        'Compte : ton adresse e-mail et ton mot de passe (stocké chiffré par notre prestataire d’authentification, jamais lisible par nous).',
        'Entraînement : séances, séries, routines, exercices perso, records.',
        'Nutrition et corps : aliments et repas notés, pesées, et pour le calcul des objectifs ton sexe, ton année de naissance, ta taille et ton niveau d’activité.',
        'Profil : nom, bio et photo, si tu les renseignes.',
        'Réglages de l’app (unités, langue, thème…).',
      ],
    },
    {
      h: 'Données de santé et consentement',
      p: [
        'Le poids, l’alimentation et les mesures corporelles sont des données de santé au sens du RGPD. Nous les traitons uniquement avec ton consentement explicite, donné à la création du compte, et uniquement pour faire fonctionner l’app.',
        'Tu peux retirer ce consentement à tout moment en supprimant ton compte (Réglages → Compte → Supprimer le compte) : tes données sont alors effacées.',
      ],
    },
    {
      h: 'Pourquoi nous les utilisons',
      p: [
        'Uniquement pour te fournir le service : enregistrer et synchroniser tes données entre tes appareils, calculer tes statistiques, ta dépense estimée et tes objectifs.',
        'Pas de publicité, pas de revente, pas de partage à des fins commerciales, pas de profilage marketing.',
      ],
    },
    {
      h: 'Où elles sont stockées et qui y a accès',
      p: [
        `Sur ton compte, hébergé par Supabase (base de données et authentification), ${REGION.fr}. Des règles d’accès garantissent que chaque compte ne peut lire que ses propres données. Les échanges sont chiffrés (HTTPS).`,
        'Sur ton appareil, pour que l’app fonctionne hors ligne. Se déconnecter efface les données de l’appareil après les avoir envoyées sur ton compte.',
        'L’app elle-même est hébergée par GitHub Pages, qui enregistre des journaux techniques (dont l’adresse IP) pour livrer les pages.',
        'Recherche d’aliments : les mots recherchés et les codes-barres scannés sont envoyés à Open Food Facts, sans ton e-mail ni aucun lien avec ton compte.',
        'Les photos d’exercices sont chargées depuis jsDelivr ou GitHub, qui voient l’adresse IP technique de la requête. Les polices sont incluses dans l’app : aucune requête vers Google.',
      ],
    },
    {
      h: 'Combien de temps',
      p: ['Tant que ton compte existe. Quand tu le supprimes, tes données sont effacées immédiatement de la base ; les sauvegardes techniques de notre hébergeur sont purgées selon son propre cycle.'],
    },
    {
      h: 'Tes droits',
      p: [
        'Accès et portabilité : exporte toutes tes données à tout moment (Réglages → Exporter et importer les données).',
        'Rectification : modifie tes données directement dans l’app.',
        'Effacement : supprime ton compte depuis l’app.',
        `Pour toute question ou pour exercer un autre droit (opposition, limitation) : ${CONTACT}. Tu peux aussi introduire une réclamation auprès de la CNIL (cnil.fr).`,
      ],
    },
    { h: 'Âge minimum', p: ['Foundry est réservé aux personnes de 16 ans ou plus.'] },
    { h: 'Modifications', p: ['Si cette politique change de façon importante, l’app te le signalera et te demandera de l’accepter à nouveau.'] },
  ],
});

const privacyEn = (): LegalDoc => ({
  title: 'Privacy policy',
  updated: 'Draft version, November 2026',
  sections: [
    { h: 'Who is responsible', p: [`Foundry is published by ${PUBLISHER.en}, the controller of your data. Contact: ${CONTACT}.`] },
    {
      h: 'The data we process',
      p: [
        'Account: your email address and password (stored encrypted by our authentication provider, never readable by us).',
        'Training: workouts, sets, routines, custom exercises, records.',
        'Nutrition and body: foods and meals you log, weigh-ins, and for your targets your sex, birth year, height and activity level.',
        'Profile: name, bio and picture, if you add them.',
        'App settings (units, language, theme…).',
      ],
    },
    {
      h: 'Health data and consent',
      p: [
        'Weight, food intake and body measurements are health data under the GDPR. We process them only with your explicit consent, given when you create your account, and only to run the app.',
        'You can withdraw this consent at any time by deleting your account (Settings → Account → Delete account): your data is then erased.',
      ],
    },
    {
      h: 'Why we use it',
      p: [
        'Only to provide the service: store and sync your data across your devices, compute your statistics, estimated expenditure and targets.',
        'No advertising, no selling, no sharing for commercial purposes, no marketing profiling.',
      ],
    },
    {
      h: 'Where it is stored and who can access it',
      p: [
        `In your account, hosted by Supabase (database and authentication), ${REGION.en}. Access rules ensure each account can only read its own data. Connections are encrypted (HTTPS).`,
        'On your device, so the app works offline. Logging out erases the device copy after sending it to your account.',
        'The app itself is hosted by GitHub Pages, which keeps technical logs (including the IP address) to serve the pages.',
        'Food search: the words you search and the barcodes you scan are sent to Open Food Facts, without your email or any link to your account.',
        'Exercise photos load from jsDelivr or GitHub, which see the technical IP address of the request. Fonts are bundled with the app: no request to Google.',
      ],
    },
    {
      h: 'How long',
      p: ['As long as your account exists. When you delete it, your data is erased from the database at once; our host’s technical backups are purged on its own schedule.'],
    },
    {
      h: 'Your rights',
      p: [
        'Access and portability: export all your data at any time (Settings → Export & import data).',
        'Rectification: edit your data directly in the app.',
        'Erasure: delete your account from the app.',
        `For any question or to exercise another right (objection, restriction): ${CONTACT}. You can also complain to your data protection authority (in France, the CNIL, cnil.fr).`,
      ],
    },
    { h: 'Minimum age', p: ['Foundry is for people aged 16 or over.'] },
    { h: 'Changes', p: ['If this policy changes in a significant way, the app will tell you and ask you to accept it again.'] },
  ],
});

const termsFr = (): LegalDoc => ({
  title: 'Conditions d’utilisation',
  updated: 'Version préliminaire, novembre 2026',
  sections: [
    { h: 'Le service', p: [`Foundry est une app de suivi d’entraînement et de nutrition éditée par ${PUBLISHER.fr}. Pendant la bêta, elle est gratuite et peut évoluer, connaître des interruptions ou des bugs.`] },
    { h: 'Ton compte', p: ['Tu dois avoir 16 ans ou plus. Tu es responsable de la confidentialité de ton mot de passe et des informations que tu saisis. Un compte est personnel.'] },
    {
      h: 'Pas un avis médical',
      p: [
        'Foundry fournit des estimations (dépense énergétique, objectifs caloriques, 1RM, tendances) destinées à des adultes en bonne santé. Ce n’est ni un dispositif médical, ni un avis médical, diététique ou de coaching personnalisé.',
        'Consulte un professionnel de santé avant de changer ton alimentation ou ton entraînement, surtout en cas de grossesse, de maladie, de trouble alimentaire ou de traitement. Arrête un exercice en cas de douleur.',
        'L’app ne propose jamais moins de 1 200 kcal (femmes) ou 1 500 kcal (hommes) par jour, mais ces seuils ne remplacent pas un suivi médical.',
      ],
    },
    {
      h: 'Données de tiers',
      p: ['Les valeurs nutritionnelles viennent de bases publiques (USDA, Open Food Facts) et de contributions de la communauté : elles peuvent contenir des erreurs. Vérifie l’étiquette quand c’est important.'],
    },
    { h: 'Tes données', p: ['Tes données t’appartiennent. Tu peux les exporter ou supprimer ton compte à tout moment. Leur traitement est décrit dans la politique de confidentialité.'] },
    {
      h: 'Utilisation correcte',
      p: ['N’utilise pas l’app pour nuire à son fonctionnement, accéder aux données d’autrui ou contourner ses protections. Un compte qui le fait peut être suspendu.'],
    },
    {
      h: 'Propriété intellectuelle',
      p: [
        'Le nom Foundry, le logo, le design et le code de l’app appartiennent à l’éditeur.',
        'Photos d’exercices : Free Exercise DB (domaine public). Aliments de base : USDA FoodData Central (domaine public) via TempoLife (CC-BY-4.0). Marques et codes-barres : Open Food Facts (Open Database License). Polices : SIL Open Font License.',
      ],
    },
    {
      h: 'Responsabilité',
      p: ['L’app est fournie en l’état. Dans les limites permises par la loi, l’éditeur n’est pas responsable des dommages liés à l’utilisation des estimations ou à une perte de données ; garde des sauvegardes si tes données comptent pour toi.'],
    },
    { h: 'Modifications et droit applicable', p: ['Ces conditions peuvent évoluer ; l’app te demandera de les accepter à nouveau en cas de changement important. Elles sont régies par le droit français.'] },
  ],
});

const termsEn = (): LegalDoc => ({
  title: 'Terms of use',
  updated: 'Draft version, November 2026',
  sections: [
    { h: 'The service', p: [`Foundry is a training and nutrition tracking app published by ${PUBLISHER.en}. During the beta it is free and may change, be interrupted or have bugs.`] },
    { h: 'Your account', p: ['You must be 16 or over. You are responsible for keeping your password private and for what you enter. An account is personal.'] },
    {
      h: 'Not medical advice',
      p: [
        'Foundry gives estimates (energy expenditure, calorie targets, 1RM, trends) meant for healthy adults. It is not a medical device, nor medical, dietary or personal coaching advice.',
        'Talk to a health professional before changing your diet or training, especially if you are pregnant, ill, have an eating disorder or take medication. Stop an exercise if it hurts.',
        'The app never suggests less than 1,200 kcal (women) or 1,500 kcal (men) a day, but these floors do not replace medical care.',
      ],
    },
    { h: 'Third-party data', p: ['Nutrition values come from public databases (USDA, Open Food Facts) and community contributions: they may contain errors. Check the label when it matters.'] },
    { h: 'Your data', p: ['Your data is yours. You can export it or delete your account at any time. How it is processed is described in the privacy policy.'] },
    { h: 'Fair use', p: ['Do not use the app to disrupt it, access other people’s data or get around its protections. An account doing so may be suspended.'] },
    {
      h: 'Intellectual property',
      p: [
        'The Foundry name, logo, design and code belong to the publisher.',
        'Exercise photos: Free Exercise DB (public domain). Basic foods: USDA FoodData Central (public domain) via TempoLife (CC-BY-4.0). Brands and barcodes: Open Food Facts (Open Database License). Typefaces: SIL Open Font License.',
      ],
    },
    {
      h: 'Liability',
      p: ['The app is provided as is. To the extent the law allows, the publisher is not liable for damage arising from use of the estimates or from data loss; keep backups if your data matters to you.'],
    },
    { h: 'Changes and governing law', p: ['These terms may change; the app will ask you to accept them again after a significant change. They are governed by French law.'] },
  ],
});

export const privacyPolicy = () => (getLang() === 'fr' ? privacyFr() : privacyEn());
export const termsOfUse = () => (getLang() === 'fr' ? termsFr() : termsEn());
