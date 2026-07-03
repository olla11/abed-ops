import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { sendEmail } from '@/lib/resend'

function countWorkingDays(start: string, end: string): number {
  let count = 0
  const d = new Date(start)
  const endDate = new Date(end)
  while (d <= endDate) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase.from('conges')
    .select('*, type_conge:types_conge(nom)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conges: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await service
    .from('profiles')
    .select('manager_id, nom, prenoms, email')
    .eq('id', user.id).single()

  if (!profile?.manager_id) {
    return NextResponse.json({ error: 'Aucun responsable technique assigné à votre profil. Contactez les RH.' }, { status: 400 })
  }

  const body = await req.json()
  const { type_conge_id, date_debut, date_fin, motif } = body

  if (!date_debut || !date_fin) {
    return NextResponse.json({ error: 'Les dates de début et de fin sont obligatoires.' }, { status: 400 })
  }
  if (date_fin < date_debut) {
    return NextResponse.json({ error: 'La date de fin doit être après la date de début.' }, { status: 400 })
  }

  const nb_jours = countWorkingDays(date_debut, date_fin)

  const { data, error } = await service.from('conges').insert({
    profile_id: user.id,
    type_conge_id: type_conge_id || null,
    date_debut, date_fin, nb_jours,
    motif: motif || null,
    statut: 'en_attente',
    valideur_n1_id: profile.manager_id,
  }).select('*, type_conge:types_conge(nom)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('conges')

  await service.from('notifications').insert({
    user_id: profile.manager_id,
    titre: 'Nouvelle demande de congé',
    message: `${profile.prenoms} ${profile.nom} — ${nb_jours} jours ouvrables (${date_debut} → ${date_fin}) attend votre validation.`,
    lien: '/rh/conges',
  })

  // Email au responsable N1
  const { data: manager } = await service.from('profiles').select('email, prenoms, nom').eq('id', profile.manager_id).single()
  if (manager?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
    await sendEmail({
      to: manager.email,
      subject: `Demande de congé — ${profile.prenoms} ${profile.nom}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
          <h2 style="color:#16a34a;margin:0 0 20px">📋 Nouvelle demande de congé</h2>
          <div style="background:white;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
            <p style="margin:0 0 8px;font-size:14px;color:#374151">Bonjour <strong>${manager.prenoms} ${manager.nom}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#374151">
              <strong>${profile.prenoms} ${profile.nom}</strong> a soumis une demande de congé qui nécessite votre validation.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280;width:40%">Période</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${date_debut} → ${date_fin}</td></tr>
              <tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280">Durée</td><td style="padding:8px 12px;font-size:14px;font-weight:700">${nb_jours} jours ouvrables</td></tr>
              ${motif ? `<tr><td style="padding:8px 12px;background:#f9fafb;font-size:13px;color:#6b7280">Motif</td><td style="padding:8px 12px;font-size:14px">${motif}</td></tr>` : ''}
            </table>
            <a href="${appUrl}/rh/conges" style="display:block;text-align:center;background:#16a34a;color:white;padding:12px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
              Traiter la demande →
            </a>
          </div>
        </div>
      `,
    }).catch(e => console.error('[conges] email manager error:', e))
  }

  return NextResponse.json({ conge: data })
}
