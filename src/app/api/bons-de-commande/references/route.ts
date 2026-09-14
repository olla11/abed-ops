import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// GET ?type=tdr|contrat|expression_besoin — éléments sélectionnables comme
// référence justificative d'un bon de commande, chacun avec un libellé
// affichable directement dans le menu déroulant. Client admin (bypass RLS) :
// la policy "contrats_rh" ne couvre pas le rôle aaf (seulement
// rh/admin/de/dp/caf + son propre contrat) — avec le client normal, l'AAF ne
// verrait que son propre contrat au lieu de tous les contrats actifs.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['aaf', 'caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'accès refusé' }, { status: 403 })
  }

  const admin = createAdminClient()
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'tdr') {
    const { data, error } = await admin
      .from('tdrs').select('id, numero, titre_activite').eq('statut', 'actif').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({
      data: (data ?? []).map(t => ({ id: t.id, label: `${t.numero ?? t.id.slice(0, 8)} — ${t.titre_activite}` })),
    })
  }

  if (type === 'contrat') {
    // "Actif" = le statut opérationnel du contrat (colonne `statut`, comme
    // dans ContratsClient/statutBadge), pas l'avancement de son circuit de
    // signature électronique (`workflow_statut`, souvent absent sur les
    // anciens contrats) — et pas expiré par sa date de fin le cas échéant.
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await admin
      .from('contrats')
      .select('id, numero, type_contrat, categorie_document, profile:profiles!profile_id(nom, prenoms), destinataire_email')
      .eq('statut', 'actif').or(`date_fin.is.null,date_fin.gte.${today}`).order('created_at', { ascending: false })
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
