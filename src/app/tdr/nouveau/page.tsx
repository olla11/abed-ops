export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import NouveauTdrForm from './NouveauTdrForm'

export default async function NouveauTdrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, avatar_url, type_emploi')
    .eq('id', user.id)
    .single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={profile?.type_emploi}
        showAdmin={realRole === 'admin' && !previewRole}
        showRH={role === 'rh'}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <a href="/tdr" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Retour</a>
          <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>Nouveau TDR</h2>
        </div>
        <div className="card">
          <NouveauTdrForm />
        </div>
      </div>
    </>
  )
}
