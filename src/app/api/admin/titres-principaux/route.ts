import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'

const TITRES_UNIQUES = [
  'directeur_executif', 'directeur_programmes', 'caf', 'rh', 'aaf',
  'president_ca', 'secretaire_general_ca', 'tresorier_ca',
]

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'non authentifié' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return { error: NextResponse.json({ error: 'accès refusé' }, { status: 403 }) }
  }
  return { supabase }
}

// GET — liste les titres uniques actuellement en doublon (2+ comptes actifs),
// avec le principal actuellement désigné pour chacun.
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) return check.error

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: profiles }, { data: principaux }] = await Promise.all([
    admin.from('profiles').select('id, nom, prenoms, titre').in('titre', TITRES_UNIQUES).eq('archived', false),
    admin.from('titres_principaux').select('titre, profile_id_principal, defini_par, defini_le'),
  ])

  const parTitre = new Map<string, { id: string; nom: string; prenoms: string }[]>()
  for (const p of profiles ?? []) {
    if (!p.titre) continue
    const list = parTitre.get(p.titre) ?? []
    list.push({ id: p.id, nom: p.nom, prenoms: p.prenoms })
    parTitre.set(p.titre, list)
  }

  const doublons = [...parTitre.entries()]
    .filter(([, holders]) => holders.length > 1)
    .map(([titre, holders]) => {
      const principal = (principaux ?? []).find(p => p.titre === titre)
      return {
        titre,
        holders,
        profile_id_principal: principal?.profile_id_principal ?? null,
        defini_le: principal?.defini_le ?? null,
      }
    })

  return NextResponse.json({ doublons })
}

// POST — bascule le titulaire principal d'un titre en doublon.
export async function POST(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) return check.error
  const { supabase } = check

  const body = await req.json().catch(() => null)
  const titre = body?.titre
  const profile_id = body?.profile_id
  if (!titre || !profile_id) {
    return NextResponse.json({ error: 'titre et profile_id requis' }, { status: 400 })
  }

  const { error } = await supabase.rpc('reassigner_principal_titre', {
    p_titre: titre,
    p_nouveau_principal: profile_id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidateTag('profiles')
  return NextResponse.json({ ok: true })
}
