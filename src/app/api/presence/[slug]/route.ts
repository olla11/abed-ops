import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Public — aucune session requise, n'importe quel visiteur soumet ce
// formulaire depuis /presence/[slug] (lien ou QR affiché à l'accueil).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { nom, prenom, telephone, email, motif, reponses, site } = body

  // Piège à robots : un champ invisible pour un humain — s'il est rempli,
  // silencieusement accepté (pour ne pas indiquer au bot que le piège a
  // fonctionné) mais jamais enregistré.
  if (site) return NextResponse.json({ ok: true })

  if (!nom?.trim() || !prenom?.trim() || !telephone?.trim()) {
    return NextResponse.json({ error: 'Nom, prénom et téléphone sont obligatoires.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: config } = await admin.from('presence_config').select('id').eq('slug', slug).single()
  if (!config) return NextResponse.json({ error: 'Lien invalide.' }, { status: 404 })

  const { error } = await admin.from('presence_enregistrements').insert({
    nom: nom.trim(), prenom: prenom.trim(), telephone: telephone.trim(),
    email: (email ?? '').trim() || null,
    motif: motif || null,
    reponses: reponses ?? {},
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
