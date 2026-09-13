import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// GET — URL signée du PDF de l'appel de fonds, pour prévisualisation avant
// envoi dans le circuit de signature (statut 'brouillon') ou consultation
// une fois envoyé/signé. Accès réservé aux rôles habilités à voir Pay Roll.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'aaf', 'de', 'dp', 'administrateur', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: appel, error } = await admin.from('appels_de_fonds').select('fichier_url').eq('id', id).single()
  if (error || !appel) return NextResponse.json({ error: 'Appel de fonds introuvable' }, { status: 404 })
  if (!appel.fichier_url) return NextResponse.json({ url: null })

  const { data: signed, error: signErr } = await admin.storage.from('documents').createSignedUrl(appel.fichier_url, 60 * 10)
  if (signErr || !signed) return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}
