import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getNiveauFonction, NIVEAUX_AVEC_SENIORITE } from '@/lib/bareme'

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
    const niveauFonction = getNiveauFonction(prestataire?.titre)

    let taux: number | null = null
    let prime = 0
    let detailPrime = ''

    if (niveauFonction) {
      // Barème par niveau de fonction (Politique de rémunération PG N° 002-25) —
      // avec ancienneté pour Programme Lead/Manager et Chargé de Projet.
      const seniorite = NIVEAUX_AVEC_SENIORITE.includes(niveauFonction) ? (prestataire?.seniorite ?? null) : null
      let query = supabase.from('bareme_honoraires').select('*').eq('niveau_fonction', niveauFonction)
      query = seniorite ? query.eq('seniorite', seniorite) : query.is('seniorite', null)
      const { data: bareme } = await query.maybeSingle()

      if (bareme) {
        taux = Number(bareme.montant_heure)
        if (bareme.prime_communication_type === 'fixe') {
          prime = Number(bareme.prime_communication_fixe ?? 0)
          detailPrime = ` + prime communication ${prime.toLocaleString('fr-FR')} F`
        } else if (bareme.prime_communication_type === 'paliers_heures') {
          const { data: paliersRows } = await supabase
            .from('parametres').select('cle, valeur')
            .in('cle', ['prime_comm_palier1_borne_max', 'prime_comm_palier1_montant', 'prime_comm_palier2_borne_max', 'prime_comm_palier2_montant', 'prime_comm_palier3_montant'])
          const pm = Object.fromEntries((paliersRows ?? []).map(r => [r.cle, Number(r.valeur)]))
          const b1 = pm['prime_comm_palier1_borne_max'] ?? 100
          const b2 = pm['prime_comm_palier2_borne_max'] ?? 200
          prime = heures <= b1 ? (pm['prime_comm_palier1_montant'] ?? 15000)
            : heures <= b2 ? (pm['prime_comm_palier2_montant'] ?? 25000)
            : (pm['prime_comm_palier3_montant'] ?? 35000)
          detailPrime = ` + prime communication ${prime.toLocaleString('fr-FR')} F (${heures}h)`
        }
      }
    }

    // Repli sur les anciens taux plats (direct/crédit) si le titre du
    // prestataire n'est pas classé dans le barème par niveau de fonction.
    if (taux == null) {
      const typeEmploi = prestataire?.type_emploi ?? 'prestataire_direct'
      const clesTaux = typeEmploi === 'prestataire_credit'
        ? ['taux_horaire_credit_fcfa', 'taux_horaire_fcfa']
        : ['taux_horaire_direct_fcfa', 'taux_horaire_fcfa']
      const { data: tauxRows } = await supabase
        .from('parametres').select('cle, valeur').in('cle', clesTaux)
      const tauxMap = Object.fromEntries((tauxRows ?? []).map((r: any) => [r.cle, Number(r.valeur)]))
      taux = tauxMap[clesTaux[0]] ?? tauxMap[clesTaux[1]] ?? 1500
    }
    const tauxFinal: number = taux ?? 1500

    const montant_caf = Math.round(heures * tauxFinal) + Math.round(prime)
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
      titre: 'Timesheet validé par la CAF ✓',
      message: `${soum.titre} : ${heures} h × ${tauxFinal.toLocaleString('fr-FR')} F${detailPrime} = ${montant_caf.toLocaleString('fr-FR')} FCFA.`,
      lien: '/timesheets',
    })
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
