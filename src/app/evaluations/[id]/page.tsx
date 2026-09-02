import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AppHeader from '@/components/AppHeader'
import EvaluationForm from './EvaluationForm'
import { estRH, estAAF } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EvaluationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ depuis?: string }> }) {
  const { id } = await params
  const { depuis } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await service
    .from('profiles').select('nom, prenoms, role, titre, avatar_url, type_emploi').eq('id', user.id).single()

  const { data: ev, error } = await service
    .from('evaluations')
    .select(`
      *,
      profile:profiles!profile_id(id, nom, prenoms, email, role),
      evaluateur:profiles!evaluateur_id(id, nom, prenoms, email, civilite),
      responsable:profiles!responsable_id(id, nom, prenoms, email),
      contrat:contrats(id, type_contrat, date_debut, date_fin, poste)
    `)
    .eq('id', id)
    .single()

  if (error || !ev) redirect('/evaluations')

  // La décision CAF peut être rendue par n'importe laquelle des personnes
  // ayant ce rôle (il peut y en avoir plusieurs) — contrairement à
  // l'évaluateur (assigné d'avance, sa civilité vient directement de l'embed
  // ci-dessus), on ne connaît la civilité de qui a réellement décidé qu'une
  // fois la décision rendue (voir rendu_par, enregistré côté API).
  // La DE, elle, est un poste unique : une seule personne peut jamais porter
  // ce rôle, donc sa civilité est directement connue par son rôle, sans
  // dépendre de qui a cliqué (utile aussi si l'admin a rendu la décision à
  // sa place — rendu_par pointerait alors vers l'admin, pas la DE).
  let civiliteCafDecideur: string | null = null
  if (ev.decision_caf?.rendu_par) {
    const { data: decideurCaf } = await service.from('profiles').select('civilite').eq('id', ev.decision_caf.rendu_par).single()
    civiliteCafDecideur = decideurCaf?.civilite ?? null
  }
  const { data: profilDE } = await service.from('profiles').select('civilite').eq('role', 'de').single()
  const civiliteDeDecideur = profilDE?.civilite ?? null

  const role = profile?.role ?? ''
  const canAccess =
    ev.profile_id === user.id ||
    ev.evaluateur_id === user.id ||
    ev.responsable_id === user.id ||
    estRH(role) || ['admin', 'superadmin', 'de', 'dp'].includes(role)

  if (!canAccess) redirect('/evaluations')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        showAdmin={['admin', 'superadmin'].includes(role)}
        // Cette page sert à la fois "voir mon propre dossier" (Mon espace,
        // juste) et "la CAF/RH vient rendre une décision sur le dossier d'un
        // tiers depuis /rh/évaluations" (lien "Voir" avec ?depuis=rh) — dans
        // ce second cas, on allume le menu CAF/RH plutôt que "Mon espace".
        forceRHActive={depuis === 'rh' && estRH(role)}
        avatarUrl={profile?.avatar_url}
      />
      <div className="page-container">
        <EvaluationForm
          evaluation={ev as any}
          myId={user.id}
          myRole={role}
          civiliteCafDecideur={civiliteCafDecideur}
          civiliteDeDecideur={civiliteDeDecideur}
        />
      </div>
    </>
  )
}
