import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/database.types'

// Note: This function now creates a new client on each call
// to ensure the auth state is not stale.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
