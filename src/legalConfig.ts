/**
 * The publisher's identity, used by every legal text in the app. This is the only place to fill in.
 * While a field is empty the texts show "[to be completed]" and the About page shows a "private beta"
 * banner. Before a public or paid launch: fill in every field, have the texts reviewed, then set
 * LEGAL_DRAFT to false. A test (legalConfig.test.ts) fails, and so the deploy stops, if LEGAL_DRAFT
 * is false while a field is still empty.
 */
export const LEGAL_DRAFT = true;

export const LEGAL = {
  /** Full name, or company name. */
  publisher: '',
  /** e.g. "Entreprise individuelle (micro-entrepreneur)", "SAS au capital de 1 000 €". */
  status: '',
  /** SIREN / SIRET (France), or company number. */
  siren: '',
  /** Postal address of the publisher. */
  address: '',
  /** Address that answers questions and data requests. */
  contactEmail: '',
  /** Person legally responsible for the content (usually the publisher). */
  publicationDirector: '',
  /** Who hosts the app's pages, with their address. */
  appHost: 'GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States',
  /** Who hosts the account data, with their address (as written in Supabase's data processing agreement). */
  dataHost: '',
  /** Supabase project region, e.g. "Union européenne (Francfort, Allemagne)". */
  dataRegion: '',
  /** Consumer mediator (required before selling to consumers in France). Leave empty until then. */
  mediator: '',
} as const;

export type LegalField = keyof typeof LEGAL;

/** Fields that must be filled before LEGAL_DRAFT can be set to false (the mediator only when selling). */
export const REQUIRED_FIELDS: LegalField[] = ['publisher', 'status', 'address', 'contactEmail', 'publicationDirector', 'appHost', 'dataHost', 'dataRegion'];

export const missingLegalFields = (): LegalField[] => REQUIRED_FIELDS.filter((k) => !LEGAL[k].trim());
