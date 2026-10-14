import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Route ponctuelle (à supprimer après usage) : applique un tampon de
// signature déjà généré côté navigateur (même rendu que le circuit de
// signature formel — voir SignerClient.tsx) sur un signataire d'un bon de
// commande historique, pour que getComposedSignedUrl() l'incruste
// automatiquement comme pour une signature réelle.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { signataireId, sigImageB64, sigX, sigY, sigPage } = body
  if (!signataireId || !sigImageB64 || typeof sigX !== 'number' || typeof sigY !== 'number') {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Garde-fou : ne touche que les signataires de bons de commande historiques
  // (numéro BC0xx-26), jamais un autre type de document.
  const { data: sig, error: findErr } = await admin
    .from('signataires')
    .select('id, demande_id')
    .eq('id', signataireId)
    .maybeSingle()
  if (findErr || !sig) return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })

  const { data: bc } = await admin
    .from('bons_de_commande')
    .select('numero')
    .eq('demande_signature_id', sig.demande_id)
    .like('numero', 'BC0%-26/ABED/DE/CAF/AAF')
    .maybeSingle()
  if (!bc) return NextResponse.json({ error: 'Ce signataire ne correspond pas à un bon de commande historique BC0xx-26' }, { status: 400 })

  const { error: updateErr } = await admin
    .from('signataires')
    .update({ sig_image_b64: sigImageB64, sig_x: sigX, sig_y: sigY, sig_page: sigPage ?? 1 })
    .eq('id', signataireId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, numero: bc.numero })
}
