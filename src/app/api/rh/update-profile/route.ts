import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { deriveVilleFromAdresse } from '@/lib/rh-derive'
import { estRH } from '@/lib/roles'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || me?.role === 'admin')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = [
    'fonction', 'direction', 'telephone', 'matricule', 'adresse', 'manager_id',
    'genre', 'ville', 'niveau_etude', 'nombre_enfants',
    'badge_actif', 'badge_jours_semaine',
  ]
  const updates: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in fields) updates[k] = fields[k] === '' || fields[k] === undefined ? null : fields[k]
  }
  // Tableau vide = pas de planning particulier, équivalent à null (tous les
  // jours ouvrés) — voir badge_jours_semaine dans badge-jours.ts.
  if (Array.isArray(updates.badge_jours_semaine) && (updates.badge_jours_semaine as unknown[]).length === 0) {
    updates.badge_jours_semaine = null
  }

  // Filet de sécurité : si l'adresse change et qu'aucune ville n'a été
  // fournie, on la déduit de l'adresse plutôt que de la laisser vide.
  if (typeof updates.adresse === 'string' && !updates.ville) {
    const villeDeduite = deriveVilleFromAdresse(updates.adresse)
    if (villeDeduite) updates.ville = villeDeduite
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service.from('profiles').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('profiles')
  revalidateTag('personnel')

  return NextResponse.json({ ok: true })
}
