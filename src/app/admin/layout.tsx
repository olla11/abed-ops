import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import AdminNav from './AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, avatar_url').eq('id', user.id).single()

  if (!profile || !['admin', 'rh', 'caf'].includes(profile.role)) redirect('/dashboard')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role}
        showAdmin={profile.role === 'admin'}
        showRH={['rh', 'admin'].includes(profile.role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        <AdminNav role={profile.role} />
        {children}
      </div>
    </>
  )
}
