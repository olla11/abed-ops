import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/resend'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const body = await req.json()
  const { action, commentaire, montant_allocation } = body

  const { data: rapport } = await supabase
    .from('rapports_allocations')
    .select('*, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom,prenoms,email,id,type_emploi,role), manager:profiles!rapports_allocations_manager_id_fkey(nom,prenoms)')
    .eq('id', id).single()

  if (!rapport) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const now = new Date().toISOString()
  let update: Record<string, any> = {}
  let nextRoles: string[] | null = null
  let nextEmailSubject = ''
  let nextEmailMsg = ''

  if (role === 'manager' && rapport.status === 'soumis') {
    if (action === 'valider') {
      update = { status: 'valide_tech', manager_valide_le: now, commentaire_manager: null }
      nextRoles = ['aaf']
      nextEmailSubject = '[ABED-ONG] Rapport mensuel à traiter (AAF)'
      nextEmailMsg = 'validé techniquement par le responsable'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire requis' }, { status: 400 })
      update = { status: 'rejete_manager', commentaire_manager: commentaire }
    }
  } else if (['aaf', 'admin'].includes(role) && rapport.status === 'valide_tech') {
    if (action === 'valider') {
      if (!montant_allocation || +montant_allocation <= 0)
        return NextResponse.json({ error: 'Montant requis' }, { status: 400 })
      update = { status: 'traite_aaf', aaf_id: user.id, aaf_le: now, montant_allocation: +montant_allocation, commentaire_aaf: null }
      nextRoles = ['caf']
      nextEmailSubject = '[ABED-ONG] Rapport mensuel à valider (CAF)'
      nextEmailMsg = 'traité par l\'AAF'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire requis' }, { status: 400 })
      update = { status: 'rejete_aaf', aaf_id: user.id, aaf_le: now, commentaire_aaf: commentaire }
    }
  } else if (role === 'caf' && rapport.status === 'traite_aaf') {
    if (action === 'valider') {
      // Si le soumetteur est lui-même un directeur (DE/DP), son supérieur hiérarchique (Président du CA) doit autoriser
      const soumetteurEstDirecteur = ['de', 'dp'].includes((rapport.prestataire as any)?.role)
      update = { status: 'valide_caf', caf_id: user.id, caf_le: now, commentaire_caf: null }
      nextRoles = soumetteurEstDirecteur ? ['administrateur'] : ['de', 'dp']
      nextEmailSubject = soumetteurEstDirecteur
        ? '[ABED-ONG] Rapport mensuel DE/DP — Autorisation Président du CA requise'
        : '[ABED-ONG] Rapport mensuel — Autorisation DE/DP requise'
      nextEmailMsg = soumetteurEstDirecteur
        ? 'validé par la CAF, en attente de votre autorisation en tant que Président du CA'
        : 'validé par la CAF, en attente de votre autorisation'
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire requis' }, { status: 400 })
      update = { status: 'rejete_caf', caf_id: user.id, caf_le: now, commentaire_caf: commentaire }
    }
  } else if (['de', 'dp', 'admin', 'administrateur'].includes(role) && rapport.status === 'valide_caf') {
    if (action === 'autoriser') {
      update = { status: 'autorise', de_id: user.id, de_le: now, commentaire_de: null }
    } else {
      if (!commentaire?.trim()) return NextResponse.json({ error: 'Commentaire requis' }, { status: 400 })
      update = { status: 'refuse_de', de_id: user.id, de_le: now, commentaire_de: commentaire }
    }
  } else {
    return NextResponse.json({ error: 'Action non autorisée pour ce statut' }, { status: 400 })
  }

  const { error } = await supabase.from('rapports_allocations').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const prest = rapport.prestataire as any
  const manager = rapport.manager as any
  const estSalarie = ['cdd', 'cdi'].includes(prest.type_emploi ?? '')
  const mois = new Date(rapport.periode_annee, rapport.periode_mois - 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Email final au bénéficiaire si autorisé
  if (update.status === 'autorise') {
    const notifTitre = estSalarie ? '✓ Fiche de paie disponible' : '✓ Allocation autorisée'
    const notifMsg = estSalarie
      ? `Votre fiche de paie de ${mois} est disponible. Salaire net : ${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA.`
      : `Votre rapport de ${mois} a été autorisé. Montant : ${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA.`
    await supabase.from('notifications').insert({
      user_id: prest.id, titre: notifTitre, message: notifMsg, lien: '/timesheets',
    })
    if (prest.email) {
      try {
        await sendEmail({
          to: prest.email,
          subject: estSalarie
            ? `[ABED-ONG] ✓ Votre fiche de paie de ${mois} est disponible`
            : `[ABED-ONG] ✓ Votre allocation de ${mois} est autorisée`,
          html: buildEmailAutorise({ rapport, mois, prest, id, estSalarie }),
        })
      } catch (e) { console.error('[Email autorise]:', e) }
    }
  }

  // Email si rejeté
  if (['rejete_manager','rejete_aaf','rejete_caf','refuse_de'].includes(update.status ?? '')) {
    if (prest.email) {
      try {
        await sendEmail({
          to: prest.email,
          subject: `[ABED-ONG] Votre rapport de ${mois} a été rejeté`,
          html: buildEmailRejete({ mois, prest, commentaire }),
        })
      } catch (e) { console.error('[Email rejete]:', e) }
    }
  }

  // Email + notification à la prochaine étape
  if (nextRoles) {
    const { data: nextUsers } = await supabase
      .from('profiles').select('id, email, prenoms, nom').in('role', nextRoles)
    for (const u of nextUsers ?? []) {
      await supabase.from('notifications').insert({
        user_id: u.id,
        titre: `Rapport mensuel à traiter`,
        message: `${prest.prenoms} ${prest.nom} — ${mois}${rapport.montant_allocation ? ` — ${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA` : ''}`,
        lien: '/timesheets',
      })
      if (u.email) {
        try {
          await sendEmail({
            to: u.email,
            subject: nextEmailSubject,
            html: buildEmailEtape({ prest, mois, rapport, msg: nextEmailMsg, nom: `${u.prenoms} ${u.nom}`, estSalarie }),
          })
        } catch (e) { console.error('[Email etape]:', e) }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

function buildEmailAutorise({ rapport, mois, prest, id, estSalarie }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  const montantLabel = estSalarie ? 'SALAIRE NET' : "MONTANT DE L'ALLOCATION"
  const docLabel = estSalarie ? '📄 Télécharger la fiche de paie' : '📄 Télécharger l\'état de paiement'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">✓ ABED-ONG — ${estSalarie ? 'Fiche de paie disponible' : 'Allocation autorisée'}</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${prest.prenoms} ${prest.nom}</strong>,</p>
      <p>${estSalarie ? 'Votre bulletin de paie mensuel a été établi et autorisé par le Directeur Exécutif.' : 'Votre rapport mensuel a été validé et votre allocation autorisée.'}</p>
      <div style="background:#f0fdf4;border:1.5px solid #63a521;border-radius:8px;padding:16px 20px;margin:16px 0;">
        <div style="font-size:12px;color:#166534;font-weight:600;margin-bottom:4px;">${montantLabel}</div>
        <div style="font-size:28px;font-weight:700;color:#166534;">${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA</div>
        <div style="font-size:12px;color:#374151;margin-top:4px;">Période : ${mois}</div>
      </div>
      <p style="color:#374151;">L'AAF va faire le nécessaire pour que vous receviez votre paiement dans les meilleurs délais.</p>
      <div style="margin-top:20px;">
        <a href="${appUrl}/api/rapports-allocations/${id}/etat-paiement-pdf"
           style="display:inline-block;background:#63a521;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:10px;">
          ${docLabel}
        </a>
        <a href="${appUrl}/timesheets"
           style="display:inline-block;background:#f3f4f6;color:#374151;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #e5e7eb;">
          Voir mes rapports →
        </a>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-top:24px;">ABED-ONG · contact@abedong.org · +229 0167779141</p>
    </div>
  </div>`
}

function buildEmailEtape({ prest, mois, rapport, msg, nom, estSalarie }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#63a521;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Rapport mensuel à traiter</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>Un rapport mensuel ${estSalarie ? '(fiche de paie)' : "(allocation)"} a été <strong>${msg}</strong> et attend votre action.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="font-weight:600;padding:5px 0;width:160px;">Bénéficiaire</td><td>${prest.prenoms} ${prest.nom}</td></tr>
        <tr><td style="font-weight:600;padding:5px 0;">Période</td><td>${mois}</td></tr>
        ${rapport.montant_allocation ? `<tr><td style="font-weight:600;padding:5px 0;">${estSalarie ? 'Salaire net' : 'Allocation'}</td><td><strong>${Number(rapport.montant_allocation).toLocaleString('fr-FR')} FCFA</strong></td></tr>` : ''}
      </table>
      <a href="${appUrl}/timesheets" style="display:inline-block;background:#63a521;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">
        Traiter le rapport →
      </a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}

function buildEmailRejete({ mois, prest, commentaire }: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abed-ops-aqsc-gmzbdoc7d-olla11s-projects.vercel.app'
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#991b1b;color:white;padding:20px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:18px;">ABED-ONG — Rapport rejeté</h1>
    </div>
    <div style="padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>Bonjour <strong>${prest.prenoms} ${prest.nom}</strong>,</p>
      <p>Votre rapport mensuel de <strong>${mois}</strong> a été rejeté.</p>
      ${commentaire ? `<div style="background:#fef2f2;border-left:3px solid #991b1b;padding:12px;margin:12px 0;border-radius:0 6px 6px 0;"><strong>Motif :</strong> ${commentaire}</div>` : ''}
      <p>Veuillez corriger et resoumettre votre rapport.</p>
      <a href="${appUrl}/timesheets" style="display:inline-block;background:#63a521;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px;">Voir mes rapports →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:20px;">ABED-ONG · contact@abedong.org</p>
    </div>
  </div>`
}
