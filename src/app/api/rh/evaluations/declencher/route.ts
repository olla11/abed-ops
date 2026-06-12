import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { LOGO_PNG_B64 } from '@/lib/logo-b64'
import { escapeHtml } from '@/lib/html'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['rh', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json().catch(() => ({}))
  const { contrat_id } = body

  let contratsATraiter: { id: string; profile_id: string; type_contrat: string; date_debut: string; date_fin: string; poste: string | null }[] = []

  if (contrat_id) {
    const { data: c } = await service
      .from('contrats')
      .select('id, profile_id, type_contrat, date_debut, date_fin, poste, statut')
      .eq('id', contrat_id)
      .single()
    if (!c) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    contratsATraiter = [c]
  } else {
    // Contrats actifs avec date_fin dans 30 jours
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const { data: contrats } = await service
      .from('contrats')
      .select('id, profile_id, type_contrat, date_debut, date_fin, poste')
      .eq('statut', 'actif')
      .not('date_fin', 'is', null)
      .lte('date_fin', in30.toISOString().split('T')[0])
      .gte('date_fin', now.toISOString().split('T')[0])
    contratsATraiter = contrats ?? []
  }

  const resultats: string[] = []

  for (const contrat of contratsATraiter) {
    // Vérifier si évaluation déjà existante
    const { data: existing } = await service
      .from('evaluations')
      .select('id')
      .eq('contrat_id', contrat.id)
      .not('statut', 'eq', 'cloture')
      .maybeSingle()

    if (existing) {
      resultats.push(`Contrat ${contrat.id}: évaluation déjà en cours`)
      continue
    }

    // Récupérer le profil
    const { data: profile } = await service
      .from('profiles')
      .select('id, nom, prenoms, email, manager_id, direction')
      .eq('id', contrat.profile_id)
      .single()

    if (!profile) continue

    // Calculer durée et ancienneté
    const debut = new Date(contrat.date_debut)
    const fin = contrat.date_fin ? new Date(contrat.date_fin) : new Date()
    const dureeJours = Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24))

    // Trouver l'évaluateur (manager)
    let evaluateur_id: string | null = profile.manager_id ?? null
    let nomEvaluateur = ''

    if (evaluateur_id) {
      const { data: mgr } = await service.from('profiles').select('nom, prenoms').eq('id', evaluateur_id).single()
      if (mgr) nomEvaluateur = `${mgr.prenoms ?? ''} ${mgr.nom ?? ''}`.trim()
    }

    const { data: eval_, error: errEval } = await service
      .from('evaluations')
      .insert({
        contrat_id: contrat.id,
        profile_id: contrat.profile_id,
        evaluateur_id,
        poste: contrat.poste,
        direction: (profile as any).direction ?? null,
        nom_evaluateur: nomEvaluateur || null,
        statut: 'en_attente',
      })
      .select('id')
      .single()

    if (errEval || !eval_) {
      resultats.push(`Contrat ${contrat.id}: erreur création évaluation`)
      continue
    }

    resultats.push(`Contrat ${contrat.id}: évaluation ${eval_.id} créée`)

    // Notification in-app à l'évaluateur
    if (evaluateur_id) {
      await service.from('notifications').insert({
        user_id: evaluateur_id,
        titre: 'Évaluation à compléter',
        message: `Une évaluation de fin de contrat est à compléter pour ${profile.prenoms ?? ''} ${profile.nom ?? ''}`.trim(),
        lien: `/evaluations/${eval_.id}`,
      })

      // Email à l'évaluateur
      const { data: mgr } = await service.from('profiles').select('email, prenoms, nom').eq('id', evaluateur_id).single()
      if (mgr?.email) {
        const nomEmploye = escapeHtml(`${profile.prenoms ?? ''} ${profile.nom ?? ''}`.trim())
        const dateFin = contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : 'N/A'
        const evalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops.vercel.app'}/evaluations/${eval_.id}`

        await sendEmail({
          to: mgr.email,
          subject: `Évaluation de fin de contrat — ${nomEmploye}`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <tr><td style="background:#2d6a4f;padding:28px 32px;text-align:center;">
        <img src="cid:logo" alt="ABED" width="56" height="56" style="border-radius:50%;margin-bottom:10px;display:block;margin:0 auto 10px;"/>
        <h1 style="color:white;margin:0;font-size:22px;letter-spacing:1px;">ABED</h1>
        <p style="color:#b7e4c7;margin:6px 0 0;font-size:14px;">Évaluation de fin de contrat</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="font-size:15px;color:#374151;margin:0 0 16px;">Bonjour ${escapeHtml(mgr.prenoms ?? '')} ${escapeHtml(mgr.nom ?? '')},</p>
        <p style="font-size:15px;color:#374151;margin:0 0 16px;">
          Une évaluation de fin de contrat doit être réalisée pour <strong>${nomEmploye}</strong>, dont le contrat se termine le <strong>${dateFin}</strong>.
        </p>
        <p style="font-size:15px;color:#374151;margin:0 0 24px;">Veuillez compléter la fiche d'évaluation en cliquant sur le bouton ci-dessous.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${evalUrl}" style="background:#63a521;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Remplir l'évaluation →
          </a>
        </div>
        <p style="font-size:13px;color:#9ca3af;margin:0;">Si le bouton ne fonctionne pas, copiez ce lien : <a href="${evalUrl}" style="color:#63a521;">${evalUrl}</a></p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;">
        ABED — Système de gestion RH
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
        })
      }
    }
  }

  return NextResponse.json({ ok: true, resultats })
}
