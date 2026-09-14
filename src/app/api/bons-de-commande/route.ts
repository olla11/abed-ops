import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { genererBonDeCommandeBrouillon } from '@/lib/bon-de-commande'

// GET — liste complète (RLS filtre déjà aux rôles concernés : aaf, caf, de,
// dp, administrateur, admin, superadmin).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data, error } = await supabase.from('bons_de_commande').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// POST { fournisseurNom, fournisseurRccm?, fournisseurIfu?,
// fournisseurTelephone?, objet, dateLivraisonSouhaitee?, lignes: [{jour,
// designation, quantite, prixUnitaire}] } — AAF/admin uniquement. Génère le
// PDF à l'état 'brouillon', prévisualisable avant envoi en signature (voir
// [id]/envoyer) ou annulation (DELETE [id]).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aaf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()
  const result = await genererBonDeCommandeBrouillon(admin, {
    fournisseurNom: String(body.fournisseurNom ?? ''),
    fournisseurRccm: body.fournisseurRccm?.trim() || null,
    fournisseurIfu: body.fournisseurIfu?.trim() || null,
    fournisseurTelephone: body.fournisseurTelephone?.trim() || null,
    objet: String(body.objet ?? ''),
    dateLivraisonSouhaitee: body.dateLivraisonSouhaitee?.trim() || null,
    lignes: Array.isArray(body.lignes) ? body.lignes.map((l: { jour?: string; designation?: string; quantite?: number; prixUnitaire?: number }) => ({
      jour: String(l.jour ?? ''), designation: String(l.designation ?? ''),
      quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire),
    })) : [],
    createurId: user.id,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, numero: result.numero, bonDeCommandeId: result.bonDeCommandeId })
}
