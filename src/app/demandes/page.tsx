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
    .select('role, nom, prenoms, email, type_emploi, avatar_url')
    .eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={role === 'admin'}
        showRH={['rh','admin'].includes(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 32px", display: "grid", gap: 28 }}>
      <DemandesClient
        role={role}
        userEmail={profile?.email ?? ''}
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
      />
      </div>
    </>
  )
}