export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import DashboardTabs from '@/components/DashboardTabs'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const isManager = ['admin', 'rh', 'caf', 'de', 'administrateur'].includes(role)

  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: notifs } = await supabase
    .from('notifications').select('id, titre, message').eq('lu', false)
    .order('created_at', { ascending: false }).limit(5)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={role === 'admin'}
      />
      <DashboardTabs
        missions={(missions ?? []) as any}
        userId={user.id}
        isManager={isManager}
        notifs={notifs ?? []}
      />
    </div>
  )
}
