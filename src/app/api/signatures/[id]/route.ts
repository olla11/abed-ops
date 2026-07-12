import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: demandeId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demande, error } = await admin
    .from('demandes_signature')
    .select('id, createur_id, fichier_url')
    .eq('id', demandeId)
    .single()

  if (error || !demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.createur_id !== user.id) {
    return NextResponse.json({ error: 'Seul le créateur de la demande peut la supprimer' }, { status: 403 })
  }

  if (demande.fichier_url) {
    const rawUrl = demande.fichier_url as string
    const path = rawUrl.includes('/documents/') ? rawUrl.split('/documents/').at(-1) : rawUrl
    if (path) {
      const { error: storageErr } = await admin.storage.from('documents').remove([path])
      if (storageErr) console.error('[Signatures] Suppression fichier storage error:', storageErr)
    }
  }

  // signataires est supprimé automatiquement via ON DELETE CASCADE
  const { error: deleteErr } = await admin.from('demandes_signature').delete().eq('id', demandeId)
  if (deleteErr) {
    console.error('[Signatures] Delete demande error:', deleteErr)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
