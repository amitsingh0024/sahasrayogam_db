import { createClient } from '@supabase/supabase-js'

// RLS is disabled on the formulations table, so the anon JWT has full
// write access. The sb_secret_ key is a Management API key and is not
// a valid PostgREST JWT — use the anon key for all DB operations.
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
