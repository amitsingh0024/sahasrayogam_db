import { createClient } from '@supabase/supabase-js'

// sb_secret_ keys are blocked in the browser ("Forbidden use of secret API key
// in browser"). We need the service_role JWT (eyJ... format) from the Supabase
// dashboard → Settings → API → service_role key.
// Add it to .env as VITE_SUPABASE_SERVICE_KEY=eyJ...
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const serviceKey   = import.meta.env.VITE_SUPABASE_SERVICE_KEY
                  || import.meta.env.VITE_SUPABASE_ANON_KEY   // fallback

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
