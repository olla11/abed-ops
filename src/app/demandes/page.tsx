export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import DemandesClient from '@/components/DemandesClient'

export default async function DemandesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, email')
    .eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={role === 'admin'}
      />
      <DemandesClient
        role={role}
        userEmail={profile?.email ?? ''}
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
      />
    </div>
  )
}
