import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Détermine chez qui se trouve le dossier selon son statut
function chezQui(type: string, status: string): string {
  if (type === 'timesheet') {
    const m: Record<string, string> = {
      soumis: 'Manager (attente validation)',
      valide_tech: 'CAF (attente validation financière)',
      valide_caf: 'Clôturé (en attente paiement)',
      corrections_tech: 'Prestataire (corrections)',
      corrections_caf: 'Prestataire (corrections CAF)',
      rejete_tech: 'Rejeté par le manager',
      rejete_caf: 'Rejeté par la CAF',
    }
    return m[status] ?? status
  }
  if (type === 'rapport') {
    const m: Record<string, string> = {
      soumis: 'Manager (attente validation)',
      valide_tech: 'AAF (traitement allocation)',
      traite_aaf: 'CAF (attente validation)',
      valide_caf: 'DE (attente autorisation)',
      autorise: 'Clôturé (autorisé)',
      rejete_manager: 'Rejeté — Manager',
      rejete_aaf: 'Rejeté — AAF',
      rejete_caf: 'Rejeté — CAF',
      refuse_de: 'Refusé — DE',
    }
    return m[status] ?? status
  }
  if (type === 'om') {
    const m: Record<string, string> = {
      brouillon: 'Agent (brouillon)',
      soumis: 'CAF / DE (attente signature)',
      signe: 'Signé — en mission',
      cloture: 'Clôturé',
      annule: 'Annulé',
    }
    return m[status] ?? status
  }
  if (type === 'demande') {
    const m: Record<string, string> = {
      soumis: 'AAF (attente traitement)',
      valide_aaf: 'CAF (attente validation)',
      valide_caf: 'DE (attente autorisation)',
      autorise: 'Clôturé (autorisé)',
      rejete_aaf: 'Rejeté — AAF',
      rejete_caf: 'Rejeté — CAF',
      refuse_caf: 'Refusé — CAF',
      refuse_de: 'Refusé — DE',
    }
    return m[status] ?? status
  }
  return status
}

function isClos(type: string, status: string): boolean {
  if (type === 'timesheet') return ['valide_caf','rejete_tech','rejete_caf'].includes(status)
  if (type === 'rapport')   return ['autorise','rejete_manager','rejete_aaf','rejete_caf','refuse_de'].includes(status)
  if (type === 'om')        return ['cloture','annule'].includes(status)
  if (type === 'demande')   return ['autorise','rejete_aaf','rejete_caf','refuse_caf','refuse_de'].includes(status)
  return false
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  if (!['aaf','caf','de','admin','administrateur'].includes(role)) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const [souRes, rapRes, omRes, demRes] = await Promise.all([
    // Timesheets / soumissions
    supabase.from('soumissions')
      .select('id, titre, status, periode_mois, periode_annee, heures_retenues, montant_caf, created_at, prestataire:profiles!soumissions_prestataire_id_fkey(nom,prenoms,type_emploi)')
      .order('created_at', { ascending: false })
      .limit(300),

    // Rapports allocations
    supabase.from('rapports_allocations')
      .select('id, status, periode_mois, periode_annee, montant_allocation, created_at, rapport_texte, prestataire:profiles!rapports_allocations_prestataire_id_fkey(nom,prenoms,type_emploi)')
      .order('created_at', { ascending: false })
      .limit(300),

    // Missions / OM
    supabase.from('missions')
      .select('id, objet, status, lieu, date_debut, date_fin, montant_avance, reference, created_at, missionnaire:profiles!missions_missionnaire_id_fkey(nom,prenoms)')
      .order('created_at', { ascending: false })
      .limit(300),

    // Demandes de paiement
    supabase.from('demandes_paiement')
      .select('id, objet, status, montant, departement, urgence, created_at, demandeur:profiles!demandes_paiement_demandeur_id_fkey(nom,prenoms)')
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const items: any[] = []

  for (const s of souRes.data ?? []) {
    const p = s.prestataire as any
    items.push({
      id: s.id, type: 'timesheet',
      reference: s.titre,
      concerne: `${p?.prenoms} ${p?.nom}`,
      type_emploi: p?.type_emploi,
      periode: `${s.periode_mois}/${s.periode_annee}`,
      montant: s.montant_caf,
      status: s.status,
      chez_qui: chezQui('timesheet', s.status),
      clos: isClos('timesheet', s.status),
      created_at: s.created_at,
    })
  }

  for (const r of rapRes.data ?? []) {
    const p = r.prestataire as any
    const estSalarie = ['cdd','cdi'].includes(p?.type_emploi ?? '')
    items.push({
      id: r.id, type: 'rapport',
      reference: `Rapport ${r.periode_mois}/${r.periode_annee}`,
      concerne: `${p?.prenoms} ${p?.nom}`,
      type_emploi: p?.type_emploi,
      sous_type: estSalarie ? 'salaire' : 'allocation',
      periode: `${r.periode_mois}/${r.periode_annee}`,
      montant: r.montant_allocation,
      status: r.status,
      chez_qui: chezQui('rapport', r.status),
      clos: isClos('rapport', r.status),
      created_at: r.created_at,
    })
  }

  for (const m of omRes.data ?? []) {
    const p = m.missionnaire as any
    items.push({
      id: m.id, type: 'om',
      reference: m.reference ?? m.objet,
      concerne: `${p?.prenoms} ${p?.nom}`,
      periode: m.date_debut ? new Date(m.date_debut).toLocaleDateString('fr-FR') : '—',
      montant: m.montant_avance,
      status: m.status,
      chez_qui: chezQui('om', m.status),
      clos: isClos('om', m.status),
      created_at: m.created_at,
      meta: { lieu: m.lieu, date_fin: m.date_fin },
    })
  }

  for (const d of demRes.data ?? []) {
    const p = d.demandeur as any
    items.push({
      id: d.id, type: 'demande',
      reference: d.objet,
      concerne: `${p?.prenoms} ${p?.nom}`,
      periode: new Date(d.created_at).toLocaleDateString('fr-FR'),
      montant: d.montant,
      status: d.status,
      chez_qui: chezQui('demande', d.status),
      clos: isClos('demande', d.status),
      urgence: d.urgence,
      departement: d.departement,
      created_at: d.created_at,
    })
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ data: items })
}
