export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import ProfileAssetForm from '@/components/ProfileAssetForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, civilite, signature_url, cachet_url')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'missionnaire'
  const canUpload = ['de', 'caf', 'admin'].includes(role)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32, display: 'grid', gap: 24 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={['admin', 'caf'].includes(role)}
      />

      <h1 style={{ color: 'var(--abed-green)' }}>Mon profil</h1>

      <div className="card">
        <p><strong>Nom :</strong> {profile?.civilite} {profile?.prenoms} {profile?.nom}</p>
        <p><strong>Rôle :</strong> {role.toUpperCase()}</p>
      </div>

      {canUpload && (
        <ProfileAssetForm
          hasSignature={!!profile?.signature_url}
          hasCachet={!!profile?.cachet_url}
        />
      )}
    </div>
  )
}
