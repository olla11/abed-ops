export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, titre, message, lien, created_at, lu')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role ?? ''}
        typeEmploi={profile?.type_emploi}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="page-container">
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 24px' }}>Notifications</h2>
        <NotificationsClient initialNotifs={notifs ?? []} />
      </div>
    </>
  )
}
