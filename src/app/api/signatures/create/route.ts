import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { signExternalSignerToken } from '@/lib/external-signer-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const titre = (formData.get('titre') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const fichier = formData.get('fichier') as File | null
  const signatairesRaw = formData.get('signataires') as string | null
  const signatairesExternesRaw = formData.get('signataires_externes') as string | null

  if (!titre) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
  }

  let signatairesIds: string[] = []
  try {
    signatairesIds = JSON.parse(signatairesRaw ?? '[]')
    if (!Array.isArray(signatairesIds)) return NextResponse.json({ error: 'Liste de signataires invalide' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Liste de signataires invalide' }, { status: 400 })
  }

  let signatairesExternes: { email: string }[] = []
  try {
    const parsed = JSON.parse(signatairesExternesRaw ?? '[]')
    if (!Array.isArray(parsed)) return NextResponse.json({ error: 'Liste de signataires externes invalide' }, { status: 400 })
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    signatairesExternes = parsed
      .map((e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
      .filter((e: string) => emailRe.test(e))
      .filter((e: string, i: number, arr: string[]) => arr.indexOf(e) === i)
      .map((email: string) => ({ email }))
  } catch {
    return NextResponse.json({ error: 'Liste de signataires externes invalide' }, { status: 400 })
  }

  if (signatairesIds.length === 0 && signatairesExternes.length === 0) {
    return NextResponse.json({ error: 'Au moins un signataire est requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Upload file if provided
  let fichier_url: string | null = null
  if (fichier && fichier.size > 0) {
    // Create bucket if it doesn't exist
    await admin.storage.createBucket('documents', { public: false }).catch(() => {})

    const path = `${user.id}/${Date.now()}_${fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const arrayBuffer = await fichier.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('documents')
      .upload(path, arrayBuffer, { contentType: fichier.type || 'application/pdf', upsert: false })

    if (uploadErr) {
      console.error('[Signatures] Upload error:', uploadErr.message)
      return NextResponse.json({ error: `Erreur upload : ${uploadErr.message}` }, { status: 500 })
    }

    // URL signée valable 7 jours — stocker le path, pas l'URL publique permanente
    fichier_url = path
  }

  // Insert demande
  const { data: demande, error: demandeErr } = await admin
    .from('demandes_signature')
    .insert({ titre, description, fichier_url, createur_id: user.id })
    .select('id, titre, description, fichier_url, statut, created_at, createur_id')
    .single()

  if (demandeErr || !demande) {
    console.error('[Signatures] Insert demande error:', demandeErr)
    return NextResponse.json({ error: 'Erreur lors de la création de la demande' }, { status: 500 })
  }

  // Insert signataires (internes + externes)
  const sigRows = [
    ...signatairesIds.map((pid, idx) => ({
      demande_id: demande.id,
      profile_id: pid,
      ordre: idx,
    })),
    ...signatairesExternes.map((s, idx) => ({
      demande_id: demande.id,
      profile_id: null,
      email: s.email,
      ordre: signatairesIds.length + idx,
    })),
  ]

  const { data: insertedSigs, error: sigErr } = await admin.from('signataires').insert(sigRows).select('id, profile_id, email')
  if (sigErr) {
    console.error('[Signatures] Insert signataires error:', sigErr)
    // Clean up demande
    await admin.from('demandes_signature').delete().eq('id', demande.id)
    return NextResponse.json({ error: 'Erreur lors de l\'assignation des signataires' }, { status: 500 })
  }

  // Fetch creator profile for email body
  const { data: createur } = await admin
    .from('profiles')
    .select('nom, prenoms')
    .eq('id', user.id)
    .single()

  const createurNom = createur ? `${createur.prenoms} ${createur.nom}` : 'Un utilisateur'

  // Fetch signatory profiles (with email) and send notifications
  const { data: signatairesProfiles } = await admin
    .from('profiles')
    .select('id, nom, prenoms, email')
    .in('id', signatairesIds)

  if (signatairesProfiles) {
    // In-app notifications for each signataire
    await admin.from('notifications').insert(
      signatairesProfiles.map(p => ({
        user_id: p.id,
        titre: 'Document à signer',
        message: `${createurNom} vous a assigné comme signataire pour « ${titre} »`,
        lien: `/signatures/${demande.id}/signer`,
      }))
    ).then(({ error: e }) => { if (e) console.error('[Signatures] Notif insert error:', e) })

    await Promise.allSettled(
      signatairesProfiles.map(async (p) => {
        if (!p.email) return
        await sendEmail({
          to: p.email,
          subject: `My ABED — Document à signer : ${titre}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
              <p>Bonjour <strong>${p.prenoms} ${p.nom}</strong>,</p>
              <p><strong>${createurNom}</strong> vous a assigné comme signataire pour le document suivant :</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;font-size:16px;font-weight:700;">${titre}</p>
                ${description ? `<p style="margin:8px 0 0;color:#6b7280;">${description}</p>` : ''}
              </div>
              <p>Connectez-vous sur My ABED pour signer ce document :</p>
              <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                Voir le document
              </a>
              <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
            </div>
          `,
        }).catch(err => console.error(`[Signatures] Email error for ${p.email}:`, err))
      })
    )
  }

  // Invite les signataires externes (sans compte) par email, avec un lien magique tokenisé
  const externalRows = (insertedSigs ?? []).filter(s => !s.profile_id && s.email)
  if (externalRows.length > 0) {
    await Promise.allSettled(
      externalRows.map(async (s) => {
        const email = s.email as string
        const token = signExternalSignerToken(s.id, email)
        const lienSignature = `${APP_URL}/signatures/externe?t=${token}`
        await sendEmail({
          to: email,
          subject: `My ABED — Document à signer : ${titre}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#16a34a;">My ABED — Signature requise</h2>
              <p>Bonjour,</p>
              <p><strong>${createurNom}</strong> (ABED ONG) vous invite à signer le document suivant :</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;font-size:16px;font-weight:700;">${titre}</p>
                ${description ? `<p style="margin:8px 0 0;color:#6b7280;">${description}</p>` : ''}
              </div>
              <p>Aucun compte n'est nécessaire. Cliquez sur le bouton ci-dessous, indiquez votre nom et prénom, puis signez le document :</p>
              <a href="${lienSignature}" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                Signer le document
              </a>
              <p style="margin-top:16px;color:#9ca3af;font-size:12px;">Ce lien est personnel et valable 30 jours. Ne le partagez pas.</p>
              <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
            </div>
          `,
        }).catch(err => console.error(`[Signatures] Email externe error for ${email}:`, err))
      })
    )
  }

  // Fetch signataires rows to return with the demande
  const { data: sigRows2 } = await admin
    .from('signataires')
    .select('profile_id, email, nom_externe, signe, signe_le, profile:profiles!signataires_profile_id_fkey(nom, prenoms)')
    .eq('demande_id', demande.id)

  return NextResponse.json({
    demande: {
      ...demande,
      createur: createur ?? null,
      signataires: sigRows2 ?? [],
    }
  })
}
