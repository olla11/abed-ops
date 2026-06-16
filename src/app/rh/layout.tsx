import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RHNav from './RHNav'

export const dynamic = 'force-dynamic'

export default async function RHLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url').eq('id', user.id).single()

  if (!profile || !['rh', 'admin', 'de', 'administrateur'].includes(profile.role)) redirect('/dashboard')

  return (
    <>
      <AppHeader
        userName={`${profile.prenoms ?? ''} ${profile.nom ?? ''}`}
        userRole={profile.role}
        showRH={true}
        showAdmin={profile.role === 'admin'}
        avatarUrl={profile.avatar_url ?? null}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <RHNav role={profile.role} />
        {children}
      </div>
    </>
  )
}
