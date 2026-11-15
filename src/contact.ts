/**
 * Where feedback goes. Read at build time from VITE_CONTACT_EMAIL (a GitHub repository variable
 * named CONTACT_EMAIL, passed by the deploy workflow), so the address is not stored in the code.
 */
export const CONTACT_EMAIL: string = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ?? '';
