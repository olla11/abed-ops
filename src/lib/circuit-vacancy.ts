import { createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'
import { ajouterAuPayRoll } from '@/lib/pay-roll'
import { finaliserCongeApprouve } from '@/lib/conge-notify'

type Admin = ReturnType<typeof createAdminClient>

// Un compte "actif" = non archivé. On ne considère jamais un rôle vacant si
// quelqu'un peut encore agir dessus, même archivé récemment mais réactivé.
export async function hasActiveRoleHolder(admin: Admin, predicate: (role: string) => boolean): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role').eq('archived', false)
  return (data ?? []).some(p => predicate(p.role))
}

export async function hasActiveIndividual(admin: Admin, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const { data } = await admin.from('profiles').select('archived').eq('id', userId).maybeSingle()
  return !!data && !data.archived
}

// Trace la bascule + prévient les admin/superadmin (in-app + email) — le saut
// n'est jamais silencieux, pour qu'un rôle durablement vacant soit repéré et
// pourvu plutôt que de rester un angle mort.
export async function logAndNotifySkip(admin: Admin, opts: {
  circuit: string
  entityId: string
  entityLabel: string
  roleVacant: string
  statusFrom: string
  statusTo: string
  lien?: string
}) {
  await admin.from('circuit_skip_log').insert({
    circuit: opts.circuit, entity_id: opts.entityId, entity_label: opts.entityLabel,
    role_vacant: opts.roleVacant, status_from: opts.statusFrom, status_to: opts.statusTo,
  })
  await notifyAdmins(admin, {
    titre: '⚠️ Étape de circuit sautée (rôle vacant)',
    message: `${opts.entityLabel} : étape "${opts.roleVacant}" sautée automatiquement (aucun compte actif pour ce rôle) — ${opts.statusFrom} → ${opts.statusTo}.`,
    lien: opts.lien ?? '/admin',
    urgent: false,
  })
}

// Pour une étape qui exige une décision humaine réelle (ex: fixer un montant)
// et qu'on ne peut donc jamais sauter automatiquement — on prévient quand
// même les admins pour qu'ils débloquent manuellement le dossier.
export async function logAndNotifyEscalation(admin: Admin, opts: {
  circuit: string
  entityId: string
  entityLabel: string
  roleVacant: string
  status: string
  raison: string
  lien?: string
}) {
  await admin.from('circuit_skip_log').insert({
    circuit: opts.circuit, entity_id: opts.entityId, entity_label: opts.entityLabel,
    role_vacant: opts.roleVacant, status_from: opts.status, status_to: opts.status,
  })
  await notifyAdmins(admin, {
    titre: '🚨 Dossier bloqué — intervention requise',
    message: `${opts.entityLabel} : bloqué à l'étape "${opts.roleVacant}" (aucun compte actif). ${opts.raison}`,
    lien: opts.lien ?? '/admin',
    urgent: true,
  })
}

async function notifyAdmins(admin: Admin, opts: { titre: string; message: string; lien: string; urgent: boolean }) {
  const { data: admins } = await admin.from('profiles')
    .select('id, email, prenoms, nom').in('role', ['admin', 'superadmin']).eq('archived', false)
  await Promise.allSettled((admins ?? []).map(async a => {
    await admin.from('notifications').insert({ user_id: a.id, titre: opts.titre, message: opts.message, lien: opts.lien })
    if (a.email) {
      const { sendEmail } = await import('@/lib/resend')
      await sendEmail({
        to: a.email,
        subject: `[ABED-ONG] ${opts.titre}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:${opts.urgent ? '#991b1b' : '#b45309'};margin:0 0 12px;">${opts.titre}</h2>
          <p style="font-size:14px;color:#374151;">${opts.message}</p>
          <p style="font-size:12px;color:#6b7280;margin-top:16px;">Attribuez ce rôle à un compte actif pour éviter que cela se reproduise.</p>
        </div>`,
      }).catch(() => {})
    }
  }))
}

// ── Demandes de paiement : soumis[AAF] → valide_aaf[CAF] → valide_caf[DE] → autorise ──
// Les 3 étapes sont de simples approbations (aucune donnée à saisir) : sûres à sauter.
export async function autoSkipDemandePaiement(admin: Admin, demandeId: string) {
  for (let i = 0; i < 4; i++) {
    const { data: d } = await admin.from('demandes_paiement').select('id, objet, numero, nom_complet, code_budgetaire, demandeur_id, montant, status').eq('id', demandeId).single()
    if (!d) return

    let roleLabel = '', next = ''
    let vacant = false
    if (d.status === 'soumis') {
      roleLabel = 'AAF'; next = 'valide_aaf'
      vacant = !(await hasActiveRoleHolder(admin, r => estAAF(r) || r === 'admin' || r === 'superadmin'))
    } else if (d.status === 'valide_aaf') {
      roleLabel = 'CAF'; next = 'valide_caf'
      vacant = !(await hasActiveRoleHolder(admin, r => r === 'caf' || r === 'admin' || r === 'superadmin'))
    } else if (d.status === 'valide_caf') {
      roleLabel = 'DE'; next = 'autorise'
      vacant = !(await hasActiveRoleHolder(admin, r => r === 'de' || r === 'admin' || r === 'superadmin'))
    } else {
      return
    }
    if (!vacant) return

    await admin.from('demandes_paiement').update({ status: next }).eq('id', demandeId)
    await logAndNotifySkip(admin, {
      circuit: 'demande_paiement', entityId: demandeId, entityLabel: `Demande de paiement — ${d.objet}`,
      roleVacant: roleLabel, statusFrom: d.status, statusTo: next, lien: '/demandes',
    })

    if (next === 'autorise') {
      // Même geste que valider le dernier palier normalement (traiter/route.ts)
      // — sauter l'étape ne doit jamais faire manquer l'entrée Pay Roll.
      await ajouterAuPayRoll(admin, {
        sourceType: 'demande_paiement',
        sourceId: demandeId,
        reference: d.numero,
        beneficiaireId: d.demandeur_id,
        beneficiaireNom: d.nom_complet,
        objet: d.objet,
        codeBudgetaire: d.code_budgetaire,
        montant: d.montant,
      })
      await admin.from('notifications').insert({
        user_id: d.demandeur_id,
        titre: '✓ Demande de paiement autorisée',
        message: `Votre demande "${d.objet}" a été autorisée.`,
        lien: '/demandes',
      })
      return
    }
  }
}

// ── Rapports d'allocation : soumis[responsable nommé] → valide_tech[AAF, saisit un montant]
//    → traite_aaf[CAF] → valide_caf[DE/Administrateur] → autorise ──
// L'étape AAF exige un montant réel (jugement humain) : jamais sautée
// automatiquement, seulement signalée en escalade si personne ne peut agir.
export async function autoSkipRapportAllocation(admin: Admin, rapportId: string) {
  for (let i = 0; i < 5; i++) {
    const { data: r } = await admin.from('rapports_allocations')
      .select('id, status, manager_id, prestataire_id, periode_mois, periode_annee, montant_allocation, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom, prenoms, role, type_emploi)')
      .eq('id', rapportId).single()
    if (!r) return
    const prestataire = r.prestataire as any
    const label = `Rapport d'allocation — ${prestataire?.prenoms ?? ''} ${prestataire?.nom ?? ''} (${r.periode_mois}/${r.periode_annee})`

    if (r.status === 'soumis') {
      const vacant = !(await hasActiveIndividual(admin, r.manager_id))
      if (!vacant) return
      await admin.from('rapports_allocations').update({ status: 'valide_tech' }).eq('id', rapportId)
      await logAndNotifySkip(admin, {
        circuit: 'rapport_allocation', entityId: rapportId, entityLabel: label,
        roleVacant: 'Responsable direct assigné', statusFrom: 'soumis', statusTo: 'valide_tech', lien: '/timesheets',
      })
      continue
    }

    if (r.status === 'valide_tech') {
      const hasAAF = await hasActiveRoleHolder(admin, role => estAAF(role) || role === 'admin' || role === 'superadmin')
      if (hasAAF) return
      // Ne PEUT PAS être sauté : le montant à payer doit être fixé par un humain.
      await logAndNotifyEscalation(admin, {
        circuit: 'rapport_allocation', entityId: rapportId, entityLabel: label, roleVacant: 'AAF', status: 'valide_tech',
        raison: "Cette étape exige la saisie d'un montant d'allocation et ne peut pas être sautée automatiquement — intervention manuelle requise.",
        lien: '/timesheets',
      })
      return
    }

    if (r.status === 'traite_aaf') {
      const vacant = !(await hasActiveRoleHolder(admin, role => role === 'caf' || role === 'admin' || role === 'superadmin'))
      if (!vacant) return
      await admin.from('rapports_allocations').update({ status: 'valide_caf' }).eq('id', rapportId)
      await logAndNotifySkip(admin, {
        circuit: 'rapport_allocation', entityId: rapportId, entityLabel: label,
        roleVacant: 'CAF', statusFrom: 'traite_aaf', statusTo: 'valide_caf', lien: '/timesheets',
      })
      continue
    }

    if (r.status === 'valide_caf') {
      const soumetteurEstDirecteur = ['de', 'dp'].includes(prestataire?.role ?? '')
      const predicate = soumetteurEstDirecteur
        ? (role: string) => role === 'administrateur' || role === 'admin' || role === 'superadmin'
        : (role: string) => role === 'de' || role === 'admin' || role === 'superadmin' || role === 'administrateur'
      const vacant = !(await hasActiveRoleHolder(admin, predicate))
      if (!vacant) return
      await admin.from('rapports_allocations').update({ status: 'autorise' }).eq('id', rapportId)
      await logAndNotifySkip(admin, {
        circuit: 'rapport_allocation', entityId: rapportId, entityLabel: label,
        roleVacant: soumetteurEstDirecteur ? 'Président du CA' : 'DE', statusFrom: 'valide_caf', statusTo: 'autorise', lien: '/timesheets',
      })
      if (r.montant_allocation) {
        const estSalarie = ['cdd', 'cdi'].includes(prestataire?.type_emploi ?? '')
        const mois = new Date(r.periode_annee, r.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        // Même geste que valider le dernier palier normalement (valider/route.ts)
        // — sauter l'étape ne doit jamais faire manquer l'entrée Pay Roll.
        await ajouterAuPayRoll(admin, {
          sourceType: 'rapport_allocation',
          sourceId: rapportId,
          beneficiaireId: r.prestataire_id,
          beneficiaireNom: `${prestataire?.prenoms ?? ''} ${prestataire?.nom ?? ''}`.trim(),
          objet: `${estSalarie ? 'Salaire' : 'Allocation'} — ${mois}`,
          montant: r.montant_allocation,
        })
        await admin.from('notifications').insert({
          user_id: r.prestataire_id,
          titre: '✓ Allocation autorisée',
          message: `Votre rapport a été autorisé. Montant : ${Number(r.montant_allocation).toLocaleString('fr-FR')} FCFA.`,
          lien: '/timesheets',
        })
      }
      return
    }

    return
  }
}

// ── Réconciliation OM : reconciliation_aaf[AAF] → reconciliation_caf[CAF]
//    → reconciliation_de[DE] → cloture ──
// Les 3 étapes sont de simples approbations : sûres à sauter.
export async function autoSkipReconciliationOM(admin: Admin, missionId: string) {
  for (let i = 0; i < 4; i++) {
    const { data: m } = await admin.from('missions')
      .select('id, objet, reference, missionnaire_id, status, solde_missionnaire, a_charge_partenaire, mode_financement, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
      .eq('id', missionId).single()
    if (!m) return

    let roleLabel = '', next = ''
    let vacant = false
    if (m.status === 'reconciliation_aaf') {
      roleLabel = 'AAF'; next = 'reconciliation_caf'
      vacant = !(await hasActiveRoleHolder(admin, r => estAAF(r) || r === 'admin' || r === 'superadmin'))
    } else if (m.status === 'reconciliation_caf') {
      roleLabel = 'CAF'; next = 'reconciliation_de'
      vacant = !(await hasActiveRoleHolder(admin, r => r === 'caf' || r === 'admin' || r === 'superadmin'))
    } else if (m.status === 'reconciliation_de') {
      roleLabel = 'DE'; next = 'cloture'
      vacant = !(await hasActiveRoleHolder(admin, r => r === 'de' || r === 'admin' || r === 'superadmin'))
    } else {
      return
    }
    if (!vacant) return

    await admin.from('missions').update({ status: next, reconciliation_commentaire: null }).eq('id', missionId)
    await logAndNotifySkip(admin, {
      circuit: 'reconciliation_om', entityId: missionId, entityLabel: `Mission — ${m.objet} (${m.reference ?? m.id})`,
      roleVacant: roleLabel, statusFrom: m.status, statusTo: next, lien: `/missions/${missionId}`,
    })

    if (next === 'cloture') {
      // Même formule que valider-reconciliation-de/route.ts : solde_missionnaire
      // négatif = ABED doit encore verser ce montant au missionnaire. Sauter
      // l'étape DE ne doit jamais faire manquer l'entrée Pay Roll.
      const montantDu = (!m.a_charge_partenaire && m.mode_financement !== 'totalite_avant')
        ? Math.max(0, -(m.solde_missionnaire ?? 0))
        : 0
      if (montantDu > 0) {
        const missionnaire = m.missionnaire as any
        await ajouterAuPayRoll(admin, {
          sourceType: 'reconciliation_mission',
          sourceId: missionId,
          reference: m.reference,
          beneficiaireId: m.missionnaire_id,
          beneficiaireNom: missionnaire ? `${missionnaire.prenoms} ${missionnaire.nom}` : m.objet,
          objet: `Réconciliation mission — ${m.objet}`,
          montant: montantDu,
        })
      }
      await admin.from('notifications').insert({
        user_id: m.missionnaire_id,
        titre: 'Réconciliation autorisée — mission clôturée',
        message: `Votre réconciliation pour la mission ${m.reference ?? ''} a été autorisée. La mission est définitivement clôturée.`,
        lien: `/missions/${missionId}`,
      })
      return
    }
  }
}

// ── Congés : en_attente[responsable technique = N1 nommé, ou admin en secours]
//    → approuve_n1[RH ou CAF] → valide_rh[DE, ou DP/Administrateur en secours]
//    → approuve ──
// Les 3 étapes sont de simples approbations : sûres à sauter. Contrairement
// à l'ancien circuit à 2 étapes, chaque palier n'est désormais sautable que
// si SON PROPRE rôle est vacant — RH/CAF ne se substituent plus au
// responsable technique, ni DE/DP/Administrateur à RH/CAF.
export async function autoSkipConge(admin: Admin, congeId: string) {
  for (let i = 0; i < 4; i++) {
    const { data: c } = await admin.from('conges').select('id, statut, profile_id, valideur_n1_id, date_debut, date_fin, nb_jours').eq('id', congeId).single()
    if (!c) return

    if (c.statut === 'en_attente') {
      const hasHolder = (await hasActiveIndividual(admin, c.valideur_n1_id))
        || (await hasActiveRoleHolder(admin, r => ['admin', 'superadmin'].includes(r)))
      if (hasHolder) return
      await admin.from('conges').update({ statut: 'approuve_n1' }).eq('id', congeId)
      await logAndNotifySkip(admin, {
        circuit: 'conge', entityId: congeId, entityLabel: `Congé — ${c.date_debut} → ${c.date_fin}`,
        roleVacant: 'Responsable technique (N1)', statusFrom: 'en_attente', statusTo: 'approuve_n1', lien: '/conges',
      })
      continue
    }

    if (c.statut === 'approuve_n1') {
      const vacant = !(await hasActiveRoleHolder(admin, r => ['rh', 'caf', 'admin', 'superadmin'].includes(r)))
      if (!vacant) return
      await admin.from('conges').update({ statut: 'valide_rh' }).eq('id', congeId)
      await logAndNotifySkip(admin, {
        circuit: 'conge', entityId: congeId, entityLabel: `Congé — ${c.date_debut} → ${c.date_fin}`,
        roleVacant: 'RH / CAF', statusFrom: 'approuve_n1', statusTo: 'valide_rh', lien: '/conges',
      })
      continue
    }

    if (c.statut === 'valide_rh') {
      const vacant = !(await hasActiveRoleHolder(admin, r => ['de', 'dp', 'administrateur', 'admin', 'superadmin'].includes(r)))
      if (!vacant) return
      await admin.from('conges').update({ statut: 'approuve' }).eq('id', congeId)
      await logAndNotifySkip(admin, {
        circuit: 'conge', entityId: congeId, entityLabel: `Congé — ${c.date_debut} → ${c.date_fin}`,
        roleVacant: 'DE', statusFrom: 'valide_rh', statusTo: 'approuve', lien: '/conges',
      })
      await admin.from('notifications').insert({
        user_id: c.profile_id,
        titre: 'Congé approuvé',
        message: `Votre demande de congé (${c.date_debut} → ${c.date_fin}, ${c.nb_jours} jours) a été approuvée.`,
        lien: '/conges',
      })
      // Même geste que l'autorisation finale manuelle (route valider/) — le
      // ticket de congé et la mise à jour du solde ne doivent jamais
      // dépendre de qui a concrètement cliqué.
      await finaliserCongeApprouve(admin, congeId).catch(e => console.error('[finaliserCongeApprouve après saut]:', e))
      return
    }

    return
  }
}
