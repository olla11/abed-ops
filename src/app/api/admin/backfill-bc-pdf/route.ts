import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Route ponctuelle (à supprimer après usage) : dépose un PDF déjà rendu en
// Storage pour un bon de commande identifié par le préfixe de son numéro
// (ex: "BC001-26") et met à jour fichier_url — utilisée pour remplacer les
// PDF simplifiés générés sans Chromium par le vrai rendu (même moteur que
// l'application), sans faire transiter les octets par un outil tiers.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const form = await req.formData()
  const files = form.getAll('files') as File[]
  if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  const admin = createAdminClient()
  const results: Array<{ fichier: string; ok: boolean; error?: string }> = []

  for (const file of files) {
    const prefix = file.name.replace(/\.pdf$/i, '')
    try {
      const { data: bc, error: findErr } = await admin.from('bons_de_commande')
        .select('id, numero, created_by, demande_signature_id, fichier_url')
        .like('numero', `${prefix}/%`).maybeSingle()
      if (findErr || !bc) { results.push({ fichier: file.name, ok: false, error: 'bon de commande introuvable pour ce préfixe' }); continue }

      const bytes = new Uint8Array(await file.arrayBuffer())
      const path = `${bc.created_by}/${Date.now()}_Bon_de_commande_${prefix}.pdf`
      const { error: uploadErr } = await admin.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
      if (uploadErr) { results.push({ fichier: file.name, ok: false, error: uploadErr.message }); continue }

      await admin.from('bons_de_commande').update({ fichier_url: path }).eq('id', bc.id)
      if (bc.demande_signature_id) {
        await admin.from('demandes_signature').update({ fichier_url: path }).eq('id', bc.demande_signature_id)
      }

      results.push({ fichier: file.name, ok: true })
    } catch (e: any) {
      results.push({ fichier: file.name, ok: false, error: e?.message ?? String(e) })
    }
  }

  return NextResponse.json({ results })
}
