import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'
import { estAAF } from '@/lib/roles'
import { autoSkipExpressionBesoin } from '@/lib/circuit-vacancy'

// action: valider | rejeter | autoriser | refuser
// étape déduite du rôle: aaf/caf → valide_aaf, de → autorise
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  if (!['aaf', 'caf', 'de', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire } = body

  const { data: expression } = await supabase
    .from('expressions_besoin')
    .select('*, demandeur:profiles!expressions_besoin_demandeur_id_fkey(nom,prenoms,email,id)')
    .eq('id', id).single()

  if (!expression) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const now = new Date().toISOString()
  let update: Record<string, any> = {}
  let nextRoles: string[] | null = null
  let emailSubject = ''

  if ((estAAF(role) || role === 'admin') && expression.status === 'soumis') {
    if (action === 'valider') {
      update = { status: 'valide_aaf', aaf_id: user.id, aaf_le: now, commentaire_aaf: null }
      nextRoles = ['de']
      emailSubject = '[ABED-ONG] Expression de besoin — Autorisation DE requise'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire obligatoire' }, { status: 400 })
      update = { status: 'rejete_aaf', aaf_id: user.id, aaf_le: now, commentaire_aaf: commentaire }
    }
  } else if (['de', 'admin'].includes(role) && expression.status === 'valide_aaf') {
    if (action === 'autoriser') {
      update = { status: 'autorise', de_id: user.id, de_le: now, commentaire_de: null }
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire obligatoire' }, { status: 400 })
      update = { status: 'refuse_de', de_id: user.id, de_le: now, commentaire_de: commentaire }
    }
  } else {
    return NextResponse.json({ error: 'Action non autorisée pour ce statut' }, { status: 400 })
  }

  const { error } = await supabase.from('expressions_besoin').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Si le rôle suivant n'a plus personne d'actif, fait sauter automatiquement
  // l'étape plutôt que de bloquer la fiche.
  await autoSkipExpressionBesoin(admin, id).catch(e => console.error('[autoSkipExpressionBesoin]:', e))

  const demandeur = expression.demandeur as any

  after(async () => {
    const tasks: PromiseLike<unknown>[] = []

    if (update.status === 'autorise') {
      tasks.push(admin.from('notifications').insert({
        user_id: demandeur.id,
        titre: '✓ Expression de besoin autorisée',
        message: `Votre expression de besoin "${expression.numero ?? expression.projet_service}" a été autorisée.`,
        lien: '/besoins',
      }))
      if (demandeur.email) {
        tasks.push(sendEmail({
          to: demandeur.email,
          subject: '[ABED-ONG] ✓ Votre expression de besoin est autorisée',
          html: buildEmailDemandeur({ expression, status: 'autorisée' }),
        }).catch(e => console.error('[Email]:', e)))
      }
    } else if (['rejete_aaf', 'refuse_de'].includes(update.status)) {
      tasks.push(admin.from('notifications').insert({
        user_id: demandeur.id,
        titre: 'Expression de besoin rejetée',
        message: `Votre expression de besoin "${expression.numero ?? expression.projet_service}" a été rejetée. Motif : ${commentaire}`,
        lien: '/besoins',
      }))
      if (demandeur.email) {
        tasks.push(sendEmail({
          to: demandeur.email,
          subject: '[ABED-ONG] Votre expression de besoin a été rejetée',
          html: buildEmailDemandeur({ expression, status: 'rejetée', commentaire }),
        }).catch(e => console.error('[Email]:', e)))
      }
    }

    if (nextRoles) {
      const { data: nextUsers } = await admin.from('profiles').select('id, email, prenoms, nom').in('role', nextRoles)
      for (const u of nextUsers ?? []) {
        tasks.push(admin.from('notifications').insert({
          user_id: u.id,
          titre: 'Expression de besoin à autoriser',
          message: `${expression.nom_demandeur} — ${expression.projet_service} — ${Number(expression.montant_total).toLocaleString('fr-FR')} FCFA`,
          lien: '/de/besoins',
        }))
        if (u.email) {
          tasks.push(sendEmail({
            to: u.email,
            subject: emailSubject,
            html: buildEmailTraiteur({ expression, nom: `${u.prenoms} ${u.nom}` }),
          }).catch(e => console.error('[Email]:', e)))
        }
      }
    }

    await Promise.allSettled(tasks)
  })

  return NextResponse.json({ ok: true })
}

function buildEmailDemandeur({ expression, status, commentaire }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:${status === 'autorisée' ? '#166534' : '#991b1b'};color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Expression de besoin ${status}</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${expression.nom_demandeur}</strong>,</p>
      <p>Votre expression de besoin a été <strong>${status}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Projet / Service</td><td>${expression.projet_service}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant estimé</td><td>${Number(expression.montant_total).toLocaleString('fr-FR')} FCFA</td></tr>
        ${commentaire ? `<tr><td style="font-weight:600;padding:5px 0;">Motif</td><td>${commentaire}</td></tr>` : ''}
      </table>
      <a href="${appUrl}/besoins" style="display:inline-block;background:#166534;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Voir mes demandes →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}

function buildEmailTraiteur({ expression, nom }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#166534;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Expression de besoin</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>Une expression de besoin a été validée par l'AAF et attend votre autorisation.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Demandeur</td><td>${expression.nom_demandeur}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Projet / Service</td><td>${expression.projet_service}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant estimé</td><td><strong>${Number(expression.montant_total).toLocaleString('fr-FR')} FCFA</strong></td></tr>
      </table>
      <a href="${appUrl}/de/besoins" style="display:inline-block;background:#166534;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Traiter →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}
