import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AppHeader from '@/components/AppHeader'
import EvaluationForm from './EvaluationForm'
import { estRH, estAAF } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
      evaluateur:profiles!evaluateur_id(id, nom, prenoms, email),
      responsable:profiles!responsable_id(id, nom, prenoms, email),
      contrat:contrats(id, type_contrat, date_debut, date_fin, poste)
    `)
    .eq('id', id)
    .single()

  if (error || !ev) redirect('/evaluations')

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
        avatarUrl={profile?.avatar_url}
      />
      <div className="page-container">
        <EvaluationForm
          evaluation={ev as any}
          myId={user.id}
          myRole={role}
        />
      </div>
    </>
  )
}
