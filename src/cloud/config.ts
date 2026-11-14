/**
 * Supabase project (accounts and sync). Both values are public by design: they ship in every
 * web app, and Row Level Security in supabase/schema.sql decides who may read what.
 * VITE_SUPABASE_URL / VITE_SUPABASE_KEY override them (used by tests).
 */
const DEFAULT_URL = 'https://pkxdsqvzzjomjkdyydvl.supabase.co';
const DEFAULT_KEY = 'sb_publishable__rjC6S4gNHzsqAuqziDdEw_iJb2x_wF';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_URL;
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? DEFAULT_KEY;
export const cloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

/** Where emails (confirmation, password reset) send people back to. */
export const appUrl = () => `${location.origin}${location.pathname}`;
