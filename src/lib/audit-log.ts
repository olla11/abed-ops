import { createClient as createServiceClient } from '@supabase/supabase-js'

// Écrit une ligne du journal d'audit. Appelé depuis le middleware via
// event.waitUntil() — ne doit jamais ralentir la réponse HTTP, donc toute
// erreur est avalée (juste loguée côté serveur).
export async function logRequest(opts: {
  userId: string
  method: string
  path: string
  ip: string | null
  userAgent: string | null
}) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const admin = createServiceClient(url, key)
    const { data: profile } = await admin
      .from('profiles').select('nom, prenoms, role').eq('id', opts.userId).single()

    await admin.from('audit_log').insert({
      actor_id: opts.userId,
      actor_nom: profile?.nom ?? null,
      actor_prenoms: profile?.prenoms ?? null,
      actor_role: profile?.role ?? null,
      method: opts.method,
      path: opts.path,
      ip: opts.ip,
      user_agent: opts.userAgent,
    })
  } catch (err) {
    console.error('[audit-log]', err)
  }
}
