import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mission } = await admin
    .from('missions')
    .select('*, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
    .eq('id', id)
    .single()

  if (!mission) return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
  if (mission.missionnaire_id !== user.id) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }
  if (mission.status !== 'cloture') {
    return NextResponse.json({ error: 'La mission n\'est pas clôturée' }, { status: 400 })
  }

  const { data: gestionnaires } = await admin
    .from('profiles').select('email').in('role', ['de', 'dp', 'caf', 'administrateur'])
  const emails = (gestionnaires ?? []).map((g: any) => g.email).filter(Boolean)

  if (emails.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire (DE/CAF) trouvé' }, { status: 400 })
  }

  const rapport = mission.rapport as any ?? {}
  const pf = (mission.point_financier as any[]) ?? []
  const totalDepenses = pf.reduce((s: number, l: any) => s + (Number(l.montant) || 0), 0)
  const modeLabels: Record<string, string> = {
    credit: 'À crédit',
    avance: 'Sur avance',
    totalite_avant: 'Totalité reçue avant départ',
  }
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
  const pfHtml = pf.map((l: any) =>
    `<tr><td>${l.libelle}</td><td>${l.quantite}</td><td>${Number(l.pu).toLocaleString('fr-FR')} F</td><td><strong>${Number(l.montant).toLocaleString('fr-FR')} F</strong></td></tr>`
  ).join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:22px">ABED-ONG — Rapport de mission clôturée</h1>
      </div>
      <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="font-weight:600;width:200px;padding:6px 0">Référence</td><td>${mission.reference ?? mission.id}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0">Objet</td><td>${mission.objet}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0">Lieu</td><td>${mission.lieu}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0">Période</td><td>${fmtDate(mission.date_depart)} → ${fmtDate(mission.date_retour)}</td></tr>
          <tr><td style="font-weight:600;padding:6px 0">Mode financement</td><td>${modeLabels[mission.mode_financement ?? ''] ?? '—'}</td></tr>
        </table>
        <h3 style="color:#63a521;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Point financier</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Libellé</th><th style="padding:8px">Qté</th><th style="padding:8px">P.U.</th><th style="padding:8px">Montant</th></tr></thead>
          <tbody>${pfHtml}</tbody>
        </table>
        <div style="text-align:right;font-weight:700">Total : ${totalDepenses.toLocaleString('fr-FR')} F CFA</div>
        <p style="margin-top:24px;font-size:12px;color:#6b7280">Renvoyé le ${new Date().toLocaleDateString('fr-FR')}.</p>
      </div>
    </div>`

  try {
    await sendEmail({
      to: emails,
      subject: `[ABED] Rapport consolidé — Mission ${mission.reference ?? mission.id}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Échec envoi email' }, { status: 502 })
  }
}
