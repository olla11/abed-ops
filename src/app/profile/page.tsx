export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import ProfileEditForm from '@/components/ProfileEditForm'
import ProfileAssetForm from '@/components/ProfileAssetForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, email, civilite, telephone, ifu, fonction, signature_url, cachet_url, adresse, date_naissance, lieu_naissance, nationalite, type_emploi, avatar_url')
    .eq('id', user.id)
    .single()

  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const canUpload = ['de', 'caf', 'admin', 'administrateur'].includes(role)

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
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      <div className="page-container" style={{ maxWidth: 760 }}>
        <h2 style={{ color: 'var(--abed-green)', marginBottom: 24 }}>Mon profil</h2>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontSize: 15 }}>Informations personnelles</h3>
          <ProfileEditForm profile={{
            nom: profile?.nom ?? '',
            prenoms: profile?.prenoms ?? '',
            civilite: profile?.civilite ?? 'M.',
            email: profile?.email ?? user.email ?? '',
            telephone: profile?.telephone ?? null,
            ifu: profile?.ifu ?? null,
            fonction: profile?.fonction ?? null,
            role,
            adresse: profile?.adresse ?? null,
            date_naissance: profile?.date_naissance ?? null,
            lieu_naissance: profile?.lieu_naissance ?? null,
            nationalite: profile?.nationalite ?? null,
            avatar_url: profile?.avatar_url ?? null,
          }} />
        </div>

        {canUpload && (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 15 }}>Signature &amp; Cachet (pour les PDF)</h3>
            <ProfileAssetForm
              hasSignature={!!profile?.signature_url}
              hasCachet={!!profile?.cachet_url}
            />
          </div>
        )}
      </div>
    </>
  )
}
