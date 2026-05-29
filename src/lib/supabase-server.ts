import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Client serveur lié à la session de l'utilisateur (respecte la RLS)
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // appelé depuis un Server Component : ignorable si middleware gère le refresh
          }
        },
      },
    }
  )
}

// Client admin (service role) — contourne la RLS.
// À utiliser UNIQUEMENT dans les routes API serveur (webhooks, déclencheurs).
import { createClient as createAdmin } from '@supabase/supabase-js'
export function createAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
