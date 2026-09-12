import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

const FICHIERS_AUTORISES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const TAILLE_MAX_FICHIER = 10 * 1024 * 1024

// Complète les champs du profil ajoutés après coup au formulaire
// d'inscription (voir /api/profile/completion-statut) — même logique
// d'enregistrement que /api/auth/register pour la photo/pièce d'identité.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const dateEmbauche = form.get('date_embauche') as string | null
  const biographie = form.get('biographie') as string | null
  const consentement = form.get('consentement_communication') as string | null
  const photo = form.get('photo') as File | null
  const pieceIdentite = form.get('piece_identite') as File | null

  if (consentement && !['Oui', 'Non'].includes(consentement)) {
    return NextResponse.json({ error: 'Consentement invalide' }, { status: 400 })
  }
  if (dateEmbauche && !/^\d{4}-\d{2}-\d{2}$/.test(dateEmbauche)) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }
  for (const f of [photo, pieceIdentite]) {
    if (!f) continue
    if (!FICHIERS_AUTORISES.includes(f.type)) {
      return NextResponse.json({ error: 'Format de fichier non supporté (jpg, png, webp, pdf).' }, { status: 400 })
    }
    if (f.size > TAILLE_MAX_FICHIER) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max. 10 MB).' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}
  if (dateEmbauche) updates.date_embauche = dateEmbauche
  if (biographie) updates.biographie = biographie
  if (consentement) updates.consentement_communication = consentement === 'Oui'
  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from('profiles').update(updates).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    if (photo) {
      await admin.storage.createBucket('avatars', { public: true }).catch(() => {})
      const ext = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
      const avatarPath = `${user.id}/avatar.${ext}`
      const { error: avatarErr } = await admin.storage.from('avatars')
        .upload(avatarPath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, upsert: true })
      if (avatarErr) {
        console.error('[profile/completer] échec upload photo:', avatarErr)
        return NextResponse.json({ error: "Erreur lors du dépôt de la photo." }, { status: 500 })
      }
      const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(avatarPath)
      await admin.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      const { error: docErr } = await admin.from('personnel_documents').insert({
        profile_id: user.id, categorie: 'photo', nom_fichier: photo.name, storage_path: avatarPath, uploaded_by: user.id,
      })
      if (docErr) {
        console.error('[profile/completer] échec enregistrement photo:', docErr)
        return NextResponse.json({ error: "Erreur lors de l'enregistrement de la photo." }, { status: 500 })
      }
    }

    if (pieceIdentite) {
      await admin.storage.createBucket('dossiers-personnel', { public: false }).catch(() => {})
      const safeName = pieceIdentite.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const idPath = `${user.id}/${Date.now()}_${safeName}`
      const { error: idErr } = await admin.storage.from('dossiers-personnel')
        .upload(idPath, Buffer.from(await pieceIdentite.arrayBuffer()), { contentType: pieceIdentite.type, upsert: false })
      if (idErr) {
        console.error('[profile/completer] échec upload pièce d\'identité:', idErr)
        return NextResponse.json({ error: "Erreur lors du dépôt de la pièce d'identité." }, { status: 500 })
      }
      const { error: docErr } = await admin.from('personnel_documents').insert({
        profile_id: user.id, categorie: 'piece_identite', nom_fichier: pieceIdentite.name, storage_path: idPath, uploaded_by: user.id,
      })
      if (docErr) {
        console.error('[profile/completer] échec enregistrement pièce d\'identité:', docErr)
        return NextResponse.json({ error: "Erreur lors de l'enregistrement de la pièce d'identité." }, { status: 500 })
      }
    }
  } catch (e) {
    console.error('[profile/completer] upload error:', e)
    return NextResponse.json({ error: 'Erreur lors du dépôt des fichiers.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
