import { createClient } from "@supabase/supabase-js";
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and/or anonymous key are not set. This is a problem.');
}

// This is a client-side supabase instance.
// It is safe to use in client components.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
