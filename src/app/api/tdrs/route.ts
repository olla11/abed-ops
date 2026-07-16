import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { validate, s } from '@/lib/validate'
import { z } from 'zod'
import { CHAPITRES_DEFAUT } from '@/lib/tdr'

const TdrSchema = z.object({
  titre_activite: z.string().min(1, 'Titre requis').max(300, 'Titre trop long'),
  projet: s.shortText,
  periode: s.shortText,
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  // RLS (tdrs_select / can_access_tdr) filtre déjà : initiateur, collaborateur,
  // signataire, admin/rh, ou TDR actif/clôturé (visible de tous).
  const { data, error } = await supabase
    .from('tdrs')
    .select(`id, numero, titre_activite, projet, periode, statut, initiateur_id,
      initiateur:profiles!tdrs_initiateur_id_fkey(id, nom, prenoms),
      created_at, updated_at`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 20, window: 60 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const v = validate(TdrSchema, body)
  if ('error' in v) return v.error

  // UUID généré côté serveur (pas de .select() après l'insert) : PostgREST
  // évalue la policy SELECT sur la ligne RETURNING dans la même transaction
  // que l'INSERT, et can_access_tdr() (SECURITY DEFINER) qui se re-interroge
  // sur "tdrs" ne voit pas encore la ligne toute juste insérée à ce moment-là
  // (visibilité de snapshot) — ça faisait échouer l'insert avec une fausse
  // violation de RLS. En connaissant l'id à l'avance, on l'évite entièrement.
  const id = crypto.randomUUID()
  const { error } = await supabase.from('tdrs').insert({
    id,
    titre_activite: v.data.titre_activite.trim(),
    projet: v.data.projet?.trim() || null,
    periode: v.data.periode?.trim() || null,
    initiateur_id: user.id,
    chapitres: CHAPITRES_DEFAUT,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const admin = createAdminClient()

  // Signataires systématiques : initiateur, CAF, DE (le responsable technique
  // est ajouté à l'envoi en signature, car c'est l'initiateur qui le choisit).
  const [{ data: caf }, { data: de }] = await Promise.all([
    admin.from('profiles').select('id').eq('role', 'caf').limit(1).maybeSingle(),
    admin.from('profiles').select('id').eq('role', 'de').limit(1).maybeSingle(),
  ])

  const { error: sigErr } = await admin.from('tdr_signataires').insert([
    { tdr_id: id, role: 'initiateur', profile_id: user.id, ordre: 1 },
    { tdr_id: id, role: 'caf', profile_id: caf?.id ?? null, ordre: 3 },
    { tdr_id: id, role: 'de', profile_id: de?.id ?? null, ordre: 4 },
  ])
  if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 })

  return NextResponse.json({ data: { id } })
}
