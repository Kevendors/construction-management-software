/**
 * True when both public Supabase env vars are present. Until then the data
 * layer falls back to the in-repo mock so the app runs with zero setup.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
