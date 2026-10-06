import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend'
import { construireTicketCongeHtml, type EtapeValidation } from '@/lib/conge-ticket'

// Dernier geste du circuit congés, une fois le statut passé à 'approuve' —
// qu'il s'agisse d'une autorisation manuelle par la DE (valider/route.ts) ou
// d'un saut automatique (circuit-vacancy.ts, rôle DE vacant) : met à jour le
// solde de congés de l'employé et lui envoie le ticket de congé. Centralisé
// ici pour que les deux chemins fassent exactement le même geste.
export async function finaliserCongeApprouve(admin: SupabaseClient, congeId: string) {
  const { data: conge } = await admin
    .from('conges')
    .select(`
      *, type_conge:types_conge(nom, jours_annuels),
      profile:profiles!profile_id(nom, prenoms, email),
      n1:profiles!valideur_n1_id(nom, prenoms),
      rh:profiles!valideur_rh_id(nom, prenoms),
      de:profiles!valideur_final_id(nom, prenoms)
    `)
    .eq('id', congeId)
    .single()

  if (!conge) return
  const employe = conge.profile as any
  const typeConge = conge.type_conge as any

  // Solde de congés — jours_acquis vient du type de congé (30j annuel par
  // défaut, mais configurable par type), jours_pris s'additionne au lieu
  // d'être écrasé (une 2e demande du même type dans l'année ne doit pas
  // faire disparaître la première).
  if (conge.type_conge_id) {
    const year = new Date().getFullYear()
    const { data: existant } = await admin
      .from('soldes_conges')
      .select('jours_pris')
      .eq('profile_id', conge.profile_id)
      .eq('type_conge_id', conge.type_conge_id)
      .eq('annee', year)
      .maybeSingle()
    await admin.from('soldes_conges').upsert({
      profile_id: conge.profile_id,
      type_conge_id: conge.type_conge_id,
      annee: year,
      jours_acquis: typeConge?.jours_annuels ?? 30,
      jours_pris: (existant?.jours_pris ?? 0) + (conge.nb_jours ?? 0),
    }, { onConflict: 'profile_id,type_conge_id,annee', ignoreDuplicates: false })
  }

  if (!employe?.email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const n1 = conge.n1 as any
  const rh = conge.rh as any
  const de = conge.de as any
  const etapes: EtapeValidation[] = [
    { label: 'Responsable technique', nom: n1 ? `${n1.prenoms} ${n1.nom}` : null, date: conge.valideur_n1_le },
    { label: 'RH / CAF', nom: rh ? `${rh.prenoms} ${rh.nom}` : null, date: conge.valideur_rh_le },
    { label: 'Direction Exécutive', nom: de ? `${de.prenoms} ${de.nom}` : null, date: conge.valideur_final_le },
  ]

  const { subject, html } = construireTicketCongeHtml({
    employeNom: employe.nom, employePrenoms: employe.prenoms,
    typeConge: typeConge?.nom ?? 'Congé',
    dateDebut: conge.date_debut, dateFin: conge.date_fin, nbJours: conge.nb_jours,
    motif: conge.motif, etapes, appUrl,
  })

  await sendEmail({ to: employe.email, subject, html }).catch(e => console.error('[conge-ticket] email:', e))
}
