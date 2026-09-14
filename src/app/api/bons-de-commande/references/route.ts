import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET ?type=tdr|contrat|expression_besoin — éléments sélectionnables comme
// référence justificative d'un bon de commande, chacun avec un libellé
// affichable directement dans le menu déroulant.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type')

  if (type === 'tdr') {
    // RLS (tdrs_select) filtre déjà aux TDR visibles pour ce compte — les
    // actifs (statut 'actif') sont visibles de tous, comme dans TdrListClient.
    const { data, error } = await supabase
      .from('tdrs').select('id, numero, titre_activite').eq('statut', 'actif').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({
      data: (data ?? []).map(t => ({ id: t.id, label: `${t.numero ?? t.id.slice(0, 8)} — ${t.titre_activite}` })),
    })
  }

  if (type === 'contrat') {
    // "Actif" = circuit de signature entièrement bouclé (workflow_statut
    // 'finalise') — un contrat encore en cours de signature n'est pas
    // encore un engagement opposable à référencer sur un bon de commande.
    const { data, error } = await supabase
      .from('contrats')
      .select('id, numero, type_contrat, categorie_document, profile:profiles!profile_id(nom, prenoms), destinataire_email')
      .eq('workflow_statut', 'finalise').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({
      data: (data ?? []).map(c => {
        const profil = c.profile as unknown as { nom: string; prenoms: string } | { nom: string; prenoms: string }[] | null
        const p = Array.isArray(profil) ? profil[0] : profil
        const nom = p ? `${p.prenoms} ${p.nom}` : (c.destinataire_email ?? '')
        return { id: c.id, label: `${c.numero ?? c.id.slice(0, 8)} — ${c.categorie_document ?? c.type_contrat}${nom ? ` (${nom})` : ''}` }
      }),
    })
  }

  if (type === 'expression_besoin') {
    // Pas encore de source de données — le champ existe déjà côté formulaire
    // et en base (bon_de_commande_references), prêt à être alimenté.
    return NextResponse.json({ data: [] })
  }

  return NextResponse.json({ error: 'type invalide' }, { status: 400 })
}
