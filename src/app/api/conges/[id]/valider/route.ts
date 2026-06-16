import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'

type RouteContext = { params: Promise<{ id: string }> }

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

function emailCongeStatut(nom: string, statut: 'approuve_n1' | 'approuve' | 'rejete', conge: any, commentaire?: string) {
  const couleur = statut === 'rejete' ? '#dc2626' : '#16a34a'
  const icone = statut === 'rejete' ? '❌' : statut === 'approuve' ? '✅' : '⏳'
  const titre = statut === 'rejete' ? 'Demande de congé rejetée'
    : statut === 'approuve' ? 'Congé approuvé'
    : 'Congé validé (RH) — en attente DE'
  const message = statut === 'rejete'
    ? `Votre demande de congé a été <strong style="color:#dc2626">rejetée</strong>.${commentaire ? `<br>Motif : ${commentaire}` : ''}`
    : statut === 'approuve'
    ? `Votre demande de congé a été <strong style="color:#16a34a">approuvée définitivement</strong>. Bonne période de congé !`
    : `Votre demande a été validée par les RH et est transmise au Directeur Exécutif pour autorisation finale.`

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
      <h2 style="color:${couleur};margin:0 0 20px">${icone} ${titre}</h2>
      <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Bonjour <strong>${nom}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151">${message}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280;width:40%">Période</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${conge.date_debut} → ${conge.date_fin}</td></tr>
          <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280">Durée</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${conge.nb_jours} jours ouvrables</td></tr>
        </table>
        <a href="${appUrl}/conges" style="display:block;text-align:center;background:${couleur};color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
          Voir mes congés →
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:20px">My ABED — ABED ONG</p>
    </div>
  `
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const myRole = me?.role ?? ''

  const body = await req.json()
  const { action, commentaire } = body

  if (!['approuver', 'rejeter'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conge } = await service
    .from('conges')
    .select('*, profile:profiles!profile_id(id, nom, prenoms, email)')
    .eq('id', id)
    .single()

  if (!conge) return NextResponse.json({ error: 'Congé introuvable' }, { status: 404 })

  const employe = conge.profile as any
  const nomEmploye = `${employe?.prenoms ?? ''} ${employe?.nom ?? ''}`.trim()

  let newStatut: string
  let notifUserId: string | null = null
  let notifTitre = ''
  let notifMessage = ''

  if (action === 'rejeter') {
    newStatut = 'rejete'
    notifUserId = conge.profile_id
    notifTitre = 'Demande de congé rejetée'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}) a été rejetée.${commentaire ? ` Motif : ${commentaire}` : ''}`
  } else if (conge.statut === 'en_attente' && (conge.valideur_n1_id === user.id || ['rh', 'admin'].includes(myRole))) {
    newStatut = 'approuve_n1'
    const { data: deUsers } = await service.from('profiles').select('id, email, prenoms, nom').in('role', ['de', 'administrateur'])
    for (const de of deUsers ?? []) {
      await service.from('notifications').insert({
        user_id: de.id,
        titre: 'Congé — autorisation finale requise',
        message: `La demande de congé de ${nomEmploye} (${conge.nb_jours}j) a été validée par les RH. Autorisation finale requise.`,
        lien: '/rh/conges',
      })
      if (de.email) {
        await sendEmail({
          to: de.email,
          subject: `Congé ${nomEmploye} — autorisation finale requise`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
              <h2 style="color:#1e40af;margin:0 0 20px">⏳ Autorisation finale requise</h2>
              <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
                <p style="margin:0 0 16px;font-size:14px;color:#374151">Bonjour <strong>${de.prenoms} ${de.nom}</strong>,</p>
                <p style="margin:0 0 20px;font-size:14px;color:#374151">La demande de congé de <strong>${nomEmploye}</strong> a été validée par les RH. Votre autorisation finale est requise.</p>
                <a href="${appUrl}/rh/conges" style="display:block;text-align:center;background:#1e40af;color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
                  Autoriser →
                </a>
              </div>
            </div>
          `,
        }).catch(() => {})
      }
    }
    notifUserId = conge.profile_id
    notifTitre = 'Congé validé (RH)'
    notifMessage = `Votre demande de congé a été validée par les RH. En attente d'autorisation du Directeur Exécutif.`
  } else if (conge.statut === 'approuve_n1' && ['de', 'administrateur', 'admin'].includes(myRole)) {
    newStatut = 'approuve'
    notifUserId = conge.profile_id
    notifTitre = 'Congé approuvé'
    notifMessage = `Votre demande de congé (${conge.date_debut} → ${conge.date_fin}, ${conge.nb_jours} jours) a été approuvée.`
  } else {
    return NextResponse.json({ error: 'Action non autorisée à cette étape' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    statut: newStatut,
    commentaire_valideur: commentaire || null,
    updated_at: new Date().toISOString(),
  }
  if (newStatut === 'approuve') updates.valideur_final_id = user.id

  const { data: updated, error } = await service.from('conges').update(updates).eq('id', id).select('*, type_conge:types_conge(nom)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (notifUserId && notifTitre) {
    await service.from('notifications').insert({
      user_id: notifUserId, titre: notifTitre, message: notifMessage, lien: '/conges',
    })
  }

  // Email à l'employé pour statut final (approuvé N1, approuvé, rejeté)
  if (employe?.email && newStatut !== 'approuve_n1') {
    await sendEmail({
      to: employe.email,
      subject: newStatut === 'rejete' ? 'Demande de congé rejetée' : 'Congé approuvé — My ABED',
      html: emailCongeStatut(nomEmploye, newStatut as any, conge, commentaire),
    }).catch(() => {})
  } else if (employe?.email && newStatut === 'approuve_n1') {
    await sendEmail({
      to: employe.email,
      subject: 'Congé approuvé N1 — en attente validation RH',
      html: emailCongeStatut(nomEmploye, 'approuve_n1', conge),
    }).catch(() => {})
  }

  if (newStatut === 'approuve' && conge.type_conge_id) {
    const year = new Date().getFullYear()
    await service.from('soldes_conges').upsert({
      profile_id: conge.profile_id,
      type_conge_id: conge.type_conge_id,
      annee: year,
      jours_acquis: 30,
      jours_pris: conge.nb_jours ?? 0,
    }, { onConflict: 'profile_id,type_conge_id,annee', ignoreDuplicates: false })
  }

  return NextResponse.json({ conge: updated })
}
