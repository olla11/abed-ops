import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AppHeader from '@/components/AppHeader'
import EvaluationForm from './EvaluationForm'

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
    .from('profiles').select('nom, prenoms, role, avatar_url, type_emploi').eq('id', user.id).single()

  const { data: ev, error } = await service
    .from('evaluations')
    .select(`
      *,
      profile:profiles!profile_id(id, nom, prenoms, email, role),
      evaluateur:profiles!evaluateur_id(id, nom, prenoms, email),
      contrat:contrats(id, type_contrat, date_debut, date_fin, poste)
    `)
    .eq('id', id)
    .single()

  if (error || !ev) redirect('/evaluations')

  const role = profile?.role ?? ''
  const canAccess =
    ev.profile_id === user.id ||
    ev.evaluateur_id === user.id ||
    ['rh', 'admin', 'de'].includes(role)

  if (!canAccess) redirect('/evaluations')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showRH={role === 'rh'}
        showAdmin={role === 'admin'}
        avatarUrl={profile?.avatar_url}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <EvaluationForm
          evaluation={ev as any}
          myId={user.id}
          myRole={role}
        />
      </div>
    </>
  )
}
