import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

// action: valider | rejeter | refuser
// etape déduite du rôle: aaf → valide_aaf, caf → valide_caf, de → autorise
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, email').eq('id', user.id).single()
  const role = profile?.role ?? ''

  if (!['aaf', 'caf', 'de', 'admin', 'administrateur'].includes(role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire } = body

  const { data: demande } = await supabase
    .from('demandes_paiement')
    .select('*, demandeur:profiles!demandes_paiement_demandeur_id_fkey(nom,prenoms,email,id)')
    .eq('id', id).single()

  if (!demande) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const now = new Date().toISOString()
  let update: Record<string, any> = {}
  let nextRole: string | null = null
  let emailSubject = ''
  let emailMsg = ''

  if (['aaf', 'admin'].includes(role) && demande.status === 'soumis') {
    if (action === 'valider') {
      update = { status: 'valide_aaf', aaf_id: user.id, aaf_le: now, commentaire_aaf: null }
      nextRole = 'caf'
      emailSubject = '[ABED-ONG] Demande de paiement à valider (CAF)'
      emailMsg = 'validée par l\'AAF, en attente de votre validation'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire obligatoire' }, { status: 400 })
      update = { status: 'rejete_aaf', aaf_id: user.id, aaf_le: now, commentaire_aaf: commentaire }
    }
  } else if (role === 'caf' && demande.status === 'valide_aaf') {
    if (action === 'valider') {
      update = { status: 'valide_caf', caf_id: user.id, caf_le: now, commentaire_caf: null }
      nextRole = 'de'
      emailSubject = '[ABED-ONG] Demande de paiement — Autorisation DE requise'
      emailMsg = 'validée par la CAF, en attente d\'autorisation du Directeur Exécutif'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire obligatoire' }, { status: 400 })
      update = { status: action === 'refuser' ? 'refuse_caf' : 'rejete_caf', caf_id: user.id, caf_le: now, commentaire_caf: commentaire }
    }
  } else if (['de', 'admin', 'administrateur'].includes(role) && demande.status === 'valide_caf') {
    if (action === 'autoriser') {
      update = { status: 'autorise', de_id: user.id, de_le: now, commentaire_de: null }
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire obligatoire' }, { status: 400 })
      update = { status: 'refuse_de', de_id: user.id, de_le: now, commentaire_de: commentaire }
    }
  } else {
    return NextResponse.json({ error: 'Action non autorisée pour ce statut' }, { status: 400 })
  }

  const { error } = await supabase.from('demandes_paiement').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const demandeur = demande.demandeur as any

  // Email au demandeur si autorisation finale ou rejet
  if (update.status === 'autorise') {
    await supabase.from('notifications').insert({
      user_id: demandeur.id,
      titre: '✓ Demande de paiement autorisée',
      message: `Votre demande "${demande.objet}" a été autorisée. L'AAF procédera au paiement.`,
      lien: '/demandes',
    })
    if (demandeur.email) {
      try {
        await sendEmail({
          to: demandeur.email,
          subject: '[ABED-ONG] ✓ Votre demande de paiement est autorisée',
          html: buildEmailDemandeur({ demande, status: 'autorisée', profile }),
        })
      } catch (e) { console.error('[Email]:', e) }
    }
  } else if (['rejete_aaf','rejete_caf','refuse_caf','refuse_de'].includes(update.status)) {
    await supabase.from('notifications').insert({
      user_id: demandeur.id,
      titre: 'Demande de paiement rejetée',
      message: `Votre demande "${demande.objet}" a été rejetée. Motif : ${commentaire}`,
      lien: '/demandes',
    })
    if (demandeur.email) {
      try {
        await sendEmail({
          to: demandeur.email,
          subject: '[ABED-ONG] Votre demande de paiement a été rejetée',
          html: buildEmailDemandeur({ demande, status: 'rejetée', commentaire, profile }),
        })
      } catch (e) { console.error('[Email]:', e) }
    }
  }

  // Email à la prochaine étape
  if (nextRole) {
    const { data: nextUsers } = await supabase
      .from('profiles').select('id, email, prenoms, nom').eq('role', nextRole)
    for (const u of nextUsers ?? []) {
      await supabase.from('notifications').insert({
        user_id: u.id,
        titre: `Demande de paiement à traiter`,
        message: `${demande.nom_complet} — ${demande.objet} — ${Number(demande.montant).toLocaleString('fr-FR')} FCFA`,
        lien: '/demandes',
      })
      if (u.email) {
        try {
          await sendEmail({
            to: u.email,
            subject: emailSubject,
            html: buildEmailTraiteur({ demande, msg: emailMsg, nom: `${u.prenoms} ${u.nom}` }),
          })
        } catch (e) { console.error('[Email]:', e) }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

function buildEmailDemandeur({ demande, status, commentaire, profile }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:${status === 'autorisée' ? '#63a521' : '#991b1b'};color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Demande ${status}</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${demande.nom_complet}</strong>,</p>
      <p>Votre demande de paiement a été <strong>${status}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Objet</td><td>${demande.objet}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant</td><td>${Number(demande.montant).toLocaleString('fr-FR')} FCFA</td></tr>
        ${commentaire ? `<tr><td style="font-weight:600;padding:5px 0;">Motif</td><td>${commentaire}</td></tr>` : ''}
        ${status === 'autorisée' ? `<tr><td colspan="2" style="padding-top:12px;color:#166534;font-weight:600;">L'AAF procédera au paiement dans les meilleurs délais.</td></tr>` : ''}
      </table>
      <a href="${appUrl}/demandes" style="display:inline-block;background:#63a521;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Voir mes demandes →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}

function buildEmailTraiteur({ demande, msg, nom }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Demande de paiement</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>Une demande de paiement a été ${msg} et attend votre action.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Demandeur</td><td>${demande.nom_complet}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Objet</td><td>${demande.objet}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Montant</td><td><strong>${Number(demande.montant).toLocaleString('fr-FR')} FCFA</strong></td></tr>
      </table>
      <a href="${appUrl}/demandes" style="display:inline-block;background:#63a521;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Traiter →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}
