import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { revalidateTag } from 'next/cache'
import { sendEmail } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.app'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin', 'de'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const service = createAdminClient()

  const { data, error } = await service.from('contrats')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email, role)')
    .order('date_fin', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contrats: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const {
    profile_id, type_contrat, date_debut, poste, direction, date_fin,
    salaire_brut, observations, categorie_document, contrat_parent_id,
    objet, articles, commentaires_rh,
  } = body

  if (!profile_id || !type_contrat || !date_debut) {
    return NextResponse.json({ error: 'Employé, type et date de début sont obligatoires.' }, { status: 400 })
  }

  const categorie = categorie_document || 'Contrat'

  const service = createAdminClient()

  // For Avenant: validate parent contract exists and is active
  let parentId: string | null = null
  if (categorie === 'Avenant') {
    if (!contrat_parent_id) {
      return NextResponse.json({ error: 'Un avenant doit être lié à un contrat parent actif.' }, { status: 400 })
    }
    const { data: parent } = await service.from('contrats')
      .select('id, statut, profile_id')
      .eq('id', contrat_parent_id)
      .single()
    if (!parent || parent.statut !== 'actif') {
      return NextResponse.json({ error: 'Le contrat parent sélectionné n\'est pas actif.' }, { status: 400 })
    }
    if (parent.profile_id !== profile_id) {
      return NextResponse.json({ error: 'Le contrat parent ne correspond pas à l\'employé sélectionné.' }, { status: 400 })
    }
    parentId = contrat_parent_id
  }

  // Insert the contract
  const { data: contrat, error: insertError } = await service.from('contrats').insert({
    profile_id, type_contrat, date_debut,
    poste: poste || null,
    direction: direction || null,
    date_fin: date_fin || null,
    salaire_brut: salaire_brut || null,
    observations: observations || null,
    categorie_document: categorie,
    contrat_parent_id: parentId,
    objet: objet || null,
    articles: articles || [],
    commentaires_rh: commentaires_rh || null,
    statut: 'actif',
    workflow_statut: 'envoye_employe',
  }).select('*, profile:profiles!profile_id(id, nom, prenoms, email, role, civilite)').single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Generate contract number: 001-2026/ABED/DE/CAF/RH
  const year = new Date().getFullYear()
  let numero: string

  const { data: seqData, error: seqError } = await service
    .rpc('nextval_contrats_seq' as Parameters<typeof service.rpc>[0])

  if (!seqError && seqData != null) {
    numero = `${String(Number(seqData)).padStart(3, '0')}-${year}/ABED/DE/CAF/RH`
  } else {
    const { count } = await service.from('contrats').select('id', { count: 'exact', head: true })
    numero = `${String(count ?? 1).padStart(3, '0')}-${year}/ABED/DE/CAF/RH`
  }

  await service.from('contrats').update({ numero }).eq('id', contrat.id)

  type ProfileRow = {
    id: string; nom: string; prenoms: string; email: string | null; role: string; civilite: string | null
  }
  const profile = contrat.profile as ProfileRow | null

  // Determine signatory based on employee role
  let signataireProfile: { id: string; nom: string; prenoms: string } | null = null
  if (profile) {
    const signatoryRole = profile.role === 'de' ? 'administrateur' : 'de'
    const { data: signatories } = await service
      .from('profiles')
      .select('id, nom, prenoms')
      .eq('role', signatoryRole)
      .limit(1)
    if (signatories && signatories.length > 0) {
      signataireProfile = signatories[0] as { id: string; nom: string; prenoms: string }
    }
  }

  // Create demande_signature and signataire
  let demandeId: string | null = null
  if (signataireProfile && profile) {
    const titre = `${categorie} ${type_contrat} — ${profile.prenoms} ${profile.nom}`
    const { data: demande, error: demandeError } = await service.from('demandes_signature').insert({
      titre,
      description: `${categorie} ${numero}`,
      createur_id: user.id,
      statut: 'en_attente',
    }).select('id').single()

    if (!demandeError && demande) {
      demandeId = (demande as { id: string }).id

      await service.from('signataires').insert({
        demande_id: demandeId,
        profile_id: signataireProfile.id,
        signe: false,
        ordre: 1,
      })

      await service.from('contrats').update({ demande_signature_id: demandeId }).eq('id', contrat.id)
    }
  }

  // Notification in-app à l'employé
  await service.from('notifications').insert({
    user_id: profile_id,
    titre: `Nouveau ${categorie} établi à votre nom`,
    message: `${categorie} ${type_contrat} (réf. ${numero}) — Consultez et signez votre document sur My ABED.`,
    lien: '/mes-contrats',
  })

  // Send email to employee
  if (profile?.email) {
    const civilite = profile.civilite ?? ''
    try {
      await sendEmail({
        to: profile.email,
        subject: `Votre ${categorie} ${type_contrat} — ABED ONG`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#16a34a;">ABED ONG — ${categorie}</h2>
            <p>Bonjour ${civilite} ${profile.prenoms} ${profile.nom},</p>
            <p>Un nouveau ${categorie.toLowerCase()} a été établi à votre nom :</p>
            <ul>
              <li><strong>Référence :</strong> ${numero}</li>
              <li><strong>Catégorie :</strong> ${categorie}</li>
              <li><strong>Type :</strong> ${type_contrat}</li>
              <li><strong>Poste :</strong> ${poste ?? '—'}</li>
              <li><strong>Date de début :</strong> ${date_debut}</li>
              ${date_fin ? `<li><strong>Date de fin :</strong> ${date_fin}</li>` : ''}
            </ul>
            <p>Ce document requiert votre signature électronique. Vous pouvez aussi y ajouter des commentaires.</p>
            <p>
              <a href="${APP_URL}/signatures"
                 style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                Accéder aux signatures
              </a>
            </p>
            <p style="color:#6b7280;font-size:12px;">ABED ONG — Système de gestion RH</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[POST /api/rh/contrats] Email error:', emailErr)
    }
  }

  revalidateTag('contrats')
  const finalContrat = { ...contrat, numero, demande_signature_id: demandeId }
  return NextResponse.json({ contrat: finalContrat })
}
