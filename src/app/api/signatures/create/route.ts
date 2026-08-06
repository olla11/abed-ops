import { NextRequest, NextResponse, after } from 'next/server'
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
  const ordreSignatairesRaw = formData.get('ordre_signataires') as string | null
  const zonesSignatureRaw = formData.get('zones_signature') as string | null
  const observateursRaw = formData.get('observateurs') as string | null
  const observateursExternesRaw = formData.get('observateurs_externes') as string | null

  if (!titre) {
    return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })
  }
  if (!fichier || fichier.size === 0) {
    return NextResponse.json({ error: 'Le document est requis' }, { status: 400 })
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

  // Ordre de signature : mélange interne/externe dans l'ordre réel choisi
  // par le créateur (voir pickOrder côté client). Si absent ou incohérent
  // avec les listes ci-dessus (ancien client, ou payload corrompu), on
  // retombe sur l'ordre par défaut — tous les internes puis tous les
  // externes — pour ne jamais bloquer la création.
  type OrdreEntry = { type: 'interne' | 'externe'; value: string }
  let ordreEntries: OrdreEntry[] = [
    ...signatairesIds.map((id): OrdreEntry => ({ type: 'interne', value: id })),
    ...signatairesExternes.map((s): OrdreEntry => ({ type: 'externe', value: s.email })),
  ]
  try {
    const parsed = JSON.parse(ordreSignatairesRaw ?? 'null')
    if (Array.isArray(parsed)) {
      const candidat: OrdreEntry[] = parsed.filter((e: unknown): e is OrdreEntry =>
        !!e && typeof e === 'object' && ((e as OrdreEntry).type === 'interne' || (e as OrdreEntry).type === 'externe') && typeof (e as OrdreEntry).value === 'string'
      )
      const candidatKeys = new Set(candidat.map(e => `${e.type}:${e.value}`))
      const attenduKeys = new Set(ordreEntries.map(e => `${e.type}:${e.value}`))
      const memeEnsemble = candidatKeys.size === attenduKeys.size && [...attenduKeys].every(k => candidatKeys.has(k))
      if (memeEnsemble) ordreEntries = candidat
    }
  } catch { /* garde l'ordre par défaut */ }

  // Zones de signature imposées (optionnel) : position figée choisie par le
  // créateur, clé "type:valeur" identique à celle de ordreEntries.
  type Zone = { page: number; x: number; y: number }
  let zonesParCle: Record<string, Zone> = {}
  try {
    const parsed = JSON.parse(zonesSignatureRaw ?? 'null')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const z = v as Partial<Zone> | null
        if (z && typeof z.page === 'number' && typeof z.x === 'number' && typeof z.y === 'number') {
          zonesParCle[k] = { page: z.page, x: z.x, y: z.y }
        }
      }
    }
  } catch { zonesParCle = {} }

  // Destinataires non-signataires (observateurs) : reçoivent le document une
  // fois signé, ne signent jamais. Une personne déjà signataire ne peut pas
  // aussi être observateur sur la même demande — on la retire silencieusement
  // plutôt que de bloquer la création pour un doublon mineur.
  let observateursIds: string[] = []
  try {
    const parsed = JSON.parse(observateursRaw ?? '[]')
    if (Array.isArray(parsed)) observateursIds = parsed.filter((id: unknown) => typeof id === 'string' && !signatairesIds.includes(id))
  } catch { /* liste vide par défaut */ }

  let observateursExternes: { email: string }[] = []
  try {
    const parsed = JSON.parse(observateursExternesRaw ?? '[]')
    if (Array.isArray(parsed)) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const emailsSignataires = new Set(signatairesExternes.map(s => s.email))
      observateursExternes = parsed
        .map((e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter((e: string) => emailRe.test(e) && !emailsSignataires.has(e))
        .filter((e: string, i: number, arr: string[]) => arr.indexOf(e) === i)
        .map((email: string) => ({ email }))
    }
  } catch { /* liste vide par défaut */ }

  const admin = createAdminClient()

  // Un email externe (signataire ou observateur) qui correspond déjà à un
  // compte existant doit être sélectionné directement dans la liste interne,
  // pas invité par email (sinon on duplique l'identité de la personne).
  const tousEmailsExternes = [...signatairesExternes, ...observateursExternes]
  if (tousEmailsExternes.length > 0) {
    const emailsRecherches = new Set(tousEmailsExternes.map(s => s.email))
    const { data: tousLesProfils } = await admin.from('profiles').select('nom, prenoms, email')
    const comptesExistants = (tousLesProfils ?? []).filter(
      p => p.email && emailsRecherches.has(p.email.toLowerCase())
    )

    if (comptesExistants.length > 0) {
      const details = comptesExistants
        .map(p => `${p.email} (${p.prenoms} ${p.nom})`)
        .join(', ')
      return NextResponse.json({
        error: `Ces emails correspondent déjà à un compte existant dans le système : ${details}. Sélectionnez directement leur nom dans la liste interne au lieu de les inviter par email.`,
      }, { status: 400 })
    }
  }

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

  // Insert signataires (internes + externes, dans l'ordre choisi) + observateurs
  // (destinataires non-signataires, internes + externes — l'ordre ne compte
  // pas pour eux puisqu'ils ne signent jamais).
  // Note : les lignes ci-dessous doivent toutes fournir la même colonne
  // `est_observateur` explicitement. PostgREST construit l'INSERT à partir de
  // l'union des clés du tableau ; une ligne où la clé est absente reçoit un
  // NULL explicite au lieu du défaut de la colonne, ce qui viole sa
  // contrainte NOT NULL dès qu'un lot mélange signataires et observateurs.
  const sigRows = [
    ...ordreEntries.map((e, idx) => {
      const zone = zonesParCle[`${e.type}:${e.value}`]
      const zoneFields = zone ? { sig_page: zone.page, sig_x: zone.x, sig_y: zone.y } : {}
      return e.type === 'interne'
        ? { demande_id: demande.id, profile_id: e.value, ordre: idx, est_observateur: false, ...zoneFields }
        : { demande_id: demande.id, profile_id: null, email: e.value, ordre: idx, est_observateur: false, ...zoneFields }
    }),
    ...observateursIds.map((pid, idx) => ({
      demande_id: demande.id,
      profile_id: pid,
      ordre: ordreEntries.length + idx,
      est_observateur: true,
    })),
    ...observateursExternes.map((s, idx) => ({
      demande_id: demande.id,
      profile_id: null,
      email: s.email,
      ordre: ordreEntries.length + observateursIds.length + idx,
      est_observateur: true,
    })),
  ]

  const { data: insertedSigs, error: sigErr } = await admin.from('signataires').insert(sigRows).select('id, profile_id, email, est_observateur, ordre')
  if (sigErr) {
    console.error('[Signatures] Insert signataires error:', sigErr)
    // Clean up demande
    await admin.from('demandes_signature').delete().eq('id', demande.id)
    return NextResponse.json({ error: 'Erreur lors de l\'assignation des signataires' }, { status: 500 })
  }

  // Requêtes indépendantes — en parallèle plutôt qu'à la suite
  const [{ data: createur }, { data: signatairesProfiles }, { data: sigRows2 }] = await Promise.all([
    admin.from('profiles').select('nom, prenoms').eq('id', user.id).single(),
    admin.from('profiles').select('id, nom, prenoms, email').in('id', signatairesIds),
    admin.from('signataires').select('profile_id, email, nom_externe, signe, signe_le, est_observateur, profile:profiles!signataires_profile_id_fkey(nom, prenoms)').eq('demande_id', demande.id),
  ])

  const createurNom = createur ? `${createur.prenoms} ${createur.nom}` : 'Un utilisateur'
  // Les observateurs externes ne reçoivent pas de lien de signature à la
  // création — seulement le document final, une fois signé (voir
  // finalizeAfterSignature).
  const nonObservateurRows = (insertedSigs ?? []).filter(s => !s.est_observateur)
  const externalRows = nonObservateurRows.filter(s => !s.profile_id && s.email)

  // Signature dans l'ordre choisi : seul le premier palier (le plus petit
  // `ordre` parmi les signataires) est notifié à la création. Chaque palier
  // suivant n'est notifié qu'une fois le précédent entièrement signé (voir
  // notifyNextStep dans signature-completion.ts).
  const premierPalier = nonObservateurRows.length > 0
    ? Math.min(...nonObservateurRows.map(s => s.ordre as number))
    : 0
  const ordreParProfileId = new Map(nonObservateurRows.filter(s => s.profile_id).map(s => [s.profile_id as string, s.ordre as number]))
  const signatairesAPrevenirMaintenant = (signatairesProfiles ?? []).filter(p => ordreParProfileId.get(p.id) === premierPalier)
  const externesAPrevenirMaintenant = externalRows.filter(s => s.ordre === premierPalier)

  const rowsPremierPalier = nonObservateurRows.filter(s => s.ordre === premierPalier)
  if (rowsPremierPalier.length > 0) {
    await admin.from('signataires').update({ notifie: true }).in('id', rowsPremierPalier.map(s => s.id))
  }

  // Notifications + emails aux signataires — après la réponse, tous en parallèle
  after(async () => {
    const tasks: PromiseLike<unknown>[] = []

    if (signatairesAPrevenirMaintenant.length > 0) {
      tasks.push(
        admin.from('notifications').insert(
          signatairesAPrevenirMaintenant.map(p => ({
            user_id: p.id,
            titre: 'Document à signer',
            message: `${createurNom} vous a assigné comme signataire pour « ${titre} »`,
            lien: `/signatures/${demande.id}/signer`,
          }))
        ).then(({ error: e }) => { if (e) console.error('[Signatures] Notif insert error:', e) })
      )

      for (const p of signatairesAPrevenirMaintenant) {
        if (!p.email) continue
        tasks.push(sendEmail({
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
        }).catch(err => console.error(`[Signatures] Email error for ${p.email}:`, err)))
      }
    }

    // Invite les signataires externes (sans compte) par email, avec un lien magique tokenisé
    for (const s of externesAPrevenirMaintenant) {
      const email = s.email as string
      const token = signExternalSignerToken(s.id, email)
      const lienSignature = `${APP_URL}/signatures/externe?t=${token}`
      tasks.push(sendEmail({
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
      }).catch(err => console.error(`[Signatures] Email externe error for ${email}:`, err)))
    }

    await Promise.allSettled(tasks)
  })

  return NextResponse.json({
    demande: {
      ...demande,
      createur: createur ?? null,
      signataires: sigRows2 ?? [],
    }
  })
}
