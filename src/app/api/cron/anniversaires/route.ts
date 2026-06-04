import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// Cron job — tous les jours à 7h (UTC). Envoie un email d'anniversaire à chaque agent
// dont la date de naissance correspond au jour courant.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const today = new Date()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')

  // Récupère les profils dont le mois-jour de naissance correspond à aujourd'hui
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, nom, prenoms, civilite, email, date_naissance, fonction')
    .not('date_naissance', 'is', null)
    .not('email', 'is', null)

  const anniversaires = (profiles ?? []).filter(p => {
    if (!p.date_naissance) return false
    const [, pMm, pDd] = p.date_naissance.split('-')
    return pMm === mm && pDd === dd
  })

  if (anniversaires.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Email à l'intéressé
  for (const p of anniversaires) {
    const age = today.getFullYear() - parseInt(p.date_naissance!.split('-')[0])
    const salutation = p.civilite === 'Mme' ? `Chère ${p.prenoms}` : `Cher ${p.prenoms}`
    try {
      await sendEmail({
        to: p.email!,
        subject: `Joyeux anniversaire ${p.prenoms} ${p.nom} !`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:22px">🎂 Joyeux Anniversaire !</h1>
            </div>
            <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p style="font-size:16px">${salutation},</p>
              <p style="font-size:15px">
                Toute l'équipe d'<strong>ABED-ONG</strong> vous souhaite un très joyeux anniversaire en ce beau jour.
                ${age > 0 ? `Nous vous souhaitons une excellente ${age}ème année pleine de succès et de joie.` : ''}
              </p>
              <p style="font-size:14px;color:#6b7280">Avec toute notre gratitude pour votre engagement et votre travail.</p>
              <p style="font-size:14px"><strong>L'équipe ABED-ONG</strong></p>
            </div>
          </div>`,
      })
    } catch (e) {
      console.error('[Anniversaire] Échec email pour', p.email, e)
    }
  }

  // Notification interne à l'admin/RH
  const { data: admins } = await admin
    .from('profiles').select('id').in('role', ['admin', 'rh'])

  for (const a of admins ?? []) {
    const noms = anniversaires.map(p => `${p.prenoms} ${p.nom}`).join(', ')
    await admin.from('notifications').insert({
      user_id: a.id,
      titre: `Anniversaire aujourd'hui : ${noms}`,
      message: `${anniversaires.length} collaborateur(s) fêtent leur anniversaire aujourd'hui.`,
      lien: '/admin',
    })
  }

  return NextResponse.json({ ok: true, sent: anniversaires.length })
}
