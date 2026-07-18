import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { signExternalSignerToken } from '@/lib/external-signer-token'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://myabed.app'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: demandeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demande } = await admin
    .from('demandes_signature')
    .select('id, titre, description, statut, createur_id')
    .eq('id', demandeId)
    .single()
  if (!demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (demande.createur_id !== user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (demande.statut !== 'refusee') {
    return NextResponse.json({ error: "Cette demande n'est pas en attente de correction" }, { status: 400 })
  }

  const formData = await req.formData()
  const fichier = formData.get('fichier') as File | null
  if (!fichier || fichier.size === 0) {
    return NextResponse.json({ error: 'Veuillez joindre le document corrigé' }, { status: 400 })
  }

  const path = `${user.id}/${Date.now()}_${fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const arrayBuffer = await fichier.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from('documents')
    .upload(path, arrayBuffer, { contentType: fichier.type || 'application/pdf', upsert: false })
  if (uploadErr) {
    console.error('[Signatures] Renvoyer upload error:', uploadErr.message)
    return NextResponse.json({ error: `Erreur upload : ${uploadErr.message}` }, { status: 500 })
  }

  await admin.from('demandes_signature').update({
    fichier_url: path, statut: 'en_attente', updated_at: new Date().toISOString(),
  }).eq('id', demandeId)

  await admin.from('signataires').update({
    signe: false, signe_le: null, refuse: false, refuse_le: null, refuse_motif: null, sig_x: null, sig_y: null,
  }).eq('demande_id', demandeId)

  const { data: createur } = await admin.from('profiles').select('nom, prenoms').eq('id', user.id).single()
  const createurNom = createur ? `${createur.prenoms} ${createur.nom}` : 'Un utilisateur'

  const { data: sigs } = await admin
    .from('signataires')
    .select('id, profile_id, email')
    .eq('demande_id', demandeId)

  const internalIds = (sigs ?? []).filter(s => s.profile_id).map(s => s.profile_id as string)
  const externalRows = (sigs ?? []).filter(s => !s.profile_id && s.email)

  if (internalIds.length > 0) {
    const { data: profs } = await admin.from('profiles').select('id, nom, prenoms, email').in('id', internalIds)
    if (profs) {
      await admin.from('notifications').insert(
        profs.map(p => ({
          user_id: p.id,
          titre: 'Document corrigé à signer',
          message: `${createurNom} a corrigé et renvoyé « ${demande.titre} » pour signature`,
          lien: `/signatures/${demandeId}/signer`,
        }))
      ).then(({ error: e }) => { if (e) console.error('[Signatures] Renvoyer notif error:', e) })

      await Promise.allSettled(
        profs.map(async (p) => {
          if (!p.email) return
          await sendEmail({
            to: p.email,
            subject: `My ABED — Document corrigé à signer : ${demande.titre}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
                <h2 style="color:#16a34a;">My ABED — Document corrigé</h2>
                <p>Bonjour <strong>${p.prenoms} ${p.nom}</strong>,</p>
                <p><strong>${createurNom}</strong> a corrigé et renvoyé le document suivant pour signature :</p>
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:0;font-size:16px;font-weight:700;">${demande.titre}</p>
                </div>
                <a href="${APP_URL}/signatures" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                  Voir le document
                </a>
                <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
              </div>
            `,
          }).catch(err => console.error(`[Signatures] Renvoyer email error for ${p.email}:`, err))
        })
      )
    }
  }

  if (externalRows.length > 0) {
    await Promise.allSettled(
      externalRows.map(async (s) => {
        const email = s.email as string
        const token = signExternalSignerToken(s.id, email)
        const lienSignature = `${APP_URL}/signatures/externe?t=${token}`
        await sendEmail({
          to: email,
          subject: `My ABED — Document corrigé à signer : ${demande.titre}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
              <h2 style="color:#16a34a;">My ABED — Document corrigé</h2>
              <p>Bonjour,</p>
              <p><strong>${createurNom}</strong> (ABED ONG) a corrigé et renvoyé le document suivant pour signature :</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;font-size:16px;font-weight:700;">${demande.titre}</p>
              </div>
              <a href="${lienSignature}" style="display:inline-block;padding:10px 22px;background:#16a34a;color:white;border-radius:8px;text-decoration:none;font-weight:700;">
                Signer le document
              </a>
              <p style="margin-top:16px;color:#9ca3af;font-size:12px;">Ce lien est personnel et valable 30 jours. Ne le partagez pas.</p>
              <p style="margin-top:24px;color:#9ca3af;font-size:12px;">My ABED · Plateforme de gestion ABED</p>
            </div>
          `,
        }).catch(err => console.error(`[Signatures] Renvoyer email externe error for ${email}:`, err))
      })
    )
  }

  const { data: demandeUpdated } = await admin
    .from('demandes_signature')
    .select(`
      id, titre, description, fichier_url, statut, created_at, createur_id,
      createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
      signataires(profile_id, email, nom_externe, signe, signe_le, refuse, refuse_le, refuse_motif, profile:profiles!signataires_profile_id_fkey(nom, prenoms))
    `)
    .eq('id', demandeId)
    .single()

  return NextResponse.json({ ok: true, demande: demandeUpdated })
}
