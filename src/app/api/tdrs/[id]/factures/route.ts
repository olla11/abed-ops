import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'

// Le détail des factures d'un TDR (montant_depense dérivé) — l'AAF (CAF y
// compris, qui hérite de ses droits) enregistre chaque facture pendant que
// le TDR est en exécution active ("actif").

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('tdr_factures')
    .select('id, description, montant, date_facture, fichier_url, created_at, enregistre_par:profiles!tdr_factures_enregistre_par_fkey(prenoms, nom)')
    .eq('tdr_id', id)
    .order('date_facture', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const body = await req.json().catch(() => null)
  const { description, montant, date_facture, fichier_url } = body ?? {}
  if (!description?.trim()) return NextResponse.json({ error: 'Description requise' }, { status: 400 })
  if (!montant || +montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const admin = createAdminClient()
  const { data: tdr } = await admin.from('tdrs').select('id, statut, reouverte').eq('id', id).single()
  if (!tdr) return NextResponse.json({ error: 'TdR introuvable' }, { status: 404 })

  // Une fois clôturé, un TdR n'est plus modifiable par personne — sauf
  // réouverture exceptionnelle autorisée par la trésorière générale, et dans
  // ce cas réservée au CAF seul (pas à l'AAF en général).
  const enReouverture = tdr.statut === 'cloture' && tdr.reouverte
  if (enReouverture) {
    if (role !== 'caf' && !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Pendant une réouverture, seul le CAF peut corriger les factures.' }, { status: 403 })
    }
  } else {
    if (!estAAF(role) && !['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'accès réservé à l\'AAF' }, { status: 403 })
    }
    if (tdr.statut !== 'actif') {
      return NextResponse.json({ error: "Les factures ne s'ajoutent que pendant l'exécution active du TdR." }, { status: 409 })
    }
  }

  const { error } = await admin.from('tdr_factures').insert({
    tdr_id: id,
    description: description.trim(),
    montant: +montant,
    date_facture: date_facture || null,
    fichier_url: fichier_url || null,
    enregistre_par: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
