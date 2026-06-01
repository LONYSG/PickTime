import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surfaced clearly during dev/build so misconfiguration is obvious.
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
