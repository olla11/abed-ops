import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { calculerHonoraire, type BaremeHonoraireRow, type PaliersCommunication } from '@/lib/bareme'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['caf', 'admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'acces refuse — CAF uniquement' }, { status: 403 })
  }

  const body = await req.json()
  const { action, commentaire_caf } = body

  const { data: soum } = await supabase
    .from('soumissions')
    .select('id, prestataire_id, titre, heures_retenues, status, prestataire:profiles!soumissions_prestataire_id_fkey(type_emploi, titre, seniorite)')
    .eq('id', id).single()

  if (!soum) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  if (soum.status !== 'valide_tech') {
    return NextResponse.json({ error: 'Ce dossier n\'est pas encore validé techniquement.' }, { status: 400 })
  }

  if (action === 'valider') {
    const prestataire = soum.prestataire as any
    const heures = soum.heures_retenues ?? 0

    // Barème complet + paliers + repli plat direct/crédit — même logique
    // que l'aperçu affiché au manager et à la CAF avant validation
    // (ValidationManager/ValidationCAF), via la fonction pure partagée
    // calculerHonoraire, pour ne jamais diverger entre l'aperçu et le
    // montant réellement enregistré.
    const [{ data: baremes }, { data: paliersRows }, { data: tauxRows }] = await Promise.all([
      supabase.from('bareme_honoraires').select('*'),
      supabase.from('parametres').select('cle, valeur')
        .in('cle', ['prime_comm_palier1_borne_max', 'prime_comm_palier1_montant', 'prime_comm_palier2_borne_max', 'prime_comm_palier2_montant', 'prime_comm_palier3_montant']),
      supabase.from('parametres').select('cle, valeur')
        .in('cle', ['taux_horaire_direct_fcfa', 'taux_horaire_credit_fcfa', 'taux_horaire_fcfa']),
    ])
    const pm = Object.fromEntries((paliersRows ?? []).map(r => [r.cle, Number(r.valeur)]))
    const paliers: PaliersCommunication = {
      palier1_borne_max: pm['prime_comm_palier1_borne_max'] ?? 100,
      palier1_montant: pm['prime_comm_palier1_montant'] ?? 15000,
      palier2_borne_max: pm['prime_comm_palier2_borne_max'] ?? 200,
      palier2_montant: pm['prime_comm_palier2_montant'] ?? 25000,
      palier3_montant: pm['prime_comm_palier3_montant'] ?? 35000,
    }
    const tm = Object.fromEntries((tauxRows ?? []).map((r: any) => [r.cle, Number(r.valeur)]))
    const fallbackDirect = tm['taux_horaire_direct_fcfa'] ?? tm['taux_horaire_fcfa'] ?? 1500
    const fallbackCredit = tm['taux_horaire_credit_fcfa'] ?? tm['taux_horaire_fcfa'] ?? 1500

    const { taux: tauxFinal, montant: montant_caf, detailPrime } = calculerHonoraire({
      titre: prestataire?.titre, seniorite: prestataire?.seniorite, typeEmploi: prestataire?.type_emploi,
      heures, baremes: (baremes ?? []) as BaremeHonoraireRow[], paliers, fallbackDirect, fallbackCredit,
    })

    await supabase.from('soumissions').update({
      status: 'valide_caf',
      montant_caf,
      montant: montant_caf,
      caf_valide_par: user.id,
      caf_valide_le: new Date().toISOString(),
      commentaire_caf: null,
      corrige_le: null,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: 'Timesheet validé par la CAF — en attente du DE',
      message: `${soum.titre} : ${heures} h × ${tauxFinal.toLocaleString('fr-FR')} F${detailPrime} = ${montant_caf.toLocaleString('fr-FR')} FCFA. En attente d'autorisation finale avant paiement.`,
      lien: '/timesheets',
    })

    // Le paiement n'est possible qu'après autorisation DE — le prévenir
    // maintenant plutôt que de laisser le dossier attendre sans notification.
    const { data: deUsers } = await supabase.from('profiles').select('id').in('role', ['de', 'administrateur']).eq('archived', false)
    await Promise.allSettled((deUsers ?? []).map(d =>
      supabase.from('notifications').insert({
        user_id: d.id,
        titre: 'Timesheet à autoriser',
        message: `${soum.titre} — ${montant_caf.toLocaleString('fr-FR')} FCFA (validé CAF).`,
        lien: '/timesheets',
      })
    ))
  } else {
    if (!commentaire_caf?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est obligatoire.' }, { status: 400 })
    }
    const newStatus = action === 'rejeter' ? 'rejete_caf' : 'corrections_caf'
    await supabase.from('soumissions').update({
      status: newStatus,
      commentaire_caf,
      corrige_le: null,
    }).eq('id', id)

    await supabase.from('notifications').insert({
      user_id: soum.prestataire_id,
      titre: action === 'rejeter' ? 'Dossier rejeté par la CAF' : 'Corrections demandées par la CAF',
      message: `${soum.titre} — ${commentaire_caf}`,
      lien: '/timesheets',
    })
  }

  return NextResponse.json({ ok: true })
}
