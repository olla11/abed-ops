import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const body = await req.json()
  const { rapport_texte, fichier_rapport_url } = body

  if (!rapport_texte?.trim()) return NextResponse.json({ error: 'Rapport requis' }, { status: 400 })
  if (!fichier_rapport_url) return NextResponse.json({ error: 'Document Word requis' }, { status: 400 })

  // Vérifier que le rapport appartient à l'utilisateur et est rejeté
  const { data: rapport } = await supabase
    .from('rapports_allocations')
    .select('id, status, prestataire_id')
    .eq('id', id).single()

  if (!rapport || rapport.prestataire_id !== user.id)
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })

  const rejetable = ['rejete_manager','rejete_aaf','rejete_caf','refuse_de']
  if (!rejetable.includes(rapport.status))
    return NextResponse.json({ error: 'Ce rapport ne peut pas être re-soumis' }, { status: 400 })

  const { error } = await supabase.from('rapports_allocations').update({
    status: 'soumis',
    rapport_texte,
    fichier_rapport_url,
    commentaire_manager: null,
    commentaire_aaf: null,
    commentaire_caf: null,
    commentaire_de: null,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
