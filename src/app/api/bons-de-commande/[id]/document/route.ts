import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { getComposedSignedUrl } from '@/lib/pdf-signature'

// GET — PDF du bon de commande : brouillon avant envoi, ou document déjà
// signé (tampon du DE/PCA incrusté via getComposedSignedUrl) une fois le
// circuit terminé.
// - par défaut : { url } signée, pour l'aperçu en iframe (modale de création)
// - ?download=1 : renvoie directement le fichier avec Content-Disposition
//   attachment, pour le bouton Télécharger de l'historique AAF (conservé
//   même après clôture du circuit de signature)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aaf', 'caf', 'de', 'dp', 'administrateur', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: bc, error } = await admin.from('bons_de_commande').select('numero, fichier_url, demande_signature_id').eq('id', id).single()
  if (error || !bc) return NextResponse.json({ error: 'Bon de commande introuvable' }, { status: 404 })
  if (!bc.fichier_url) return NextResponse.json({ url: null })

  const url = bc.demande_signature_id
    ? await getComposedSignedUrl(admin, bc.demande_signature_id, bc.fichier_url, 60 * 10)
    : (await admin.storage.from('documents').createSignedUrl(bc.fichier_url, 60 * 10)).data?.signedUrl ?? null

  if (!url) return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })

  if (req.nextUrl.searchParams.get('download') === '1') {
    const fileRes = await fetch(url)
    if (!fileRes.ok) return NextResponse.json({ error: 'Téléchargement du PDF impossible' }, { status: 500 })
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const nomFichier = `Bon_de_commande_${bc.numero.split('/')[0]}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
      },
    })
  }

  return NextResponse.json({ url })
}
