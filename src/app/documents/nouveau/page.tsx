export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import RolePreviewBanner from '@/components/RolePreviewBanner'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getEffectiveRole, getRolePreview } from '@/lib/role-preview'
import { getImpersonationInfo } from '@/lib/impersonation'
import { estRH, estAAF } from '@/lib/roles'
import NouveauDocumentForm from './NouveauDocumentForm'

export default async function NouveauDocumentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()
  const realRole = profile?.role ?? 'missionnaire'
  const role = await getEffectiveRole(realRole)
  const previewRole = await getRolePreview()
  const impersonation = await getImpersonationInfo()

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        showAdmin={['admin', 'superadmin'].includes(realRole) && !previewRole}
        avatarUrl={profile?.avatar_url ?? null}
      />
      {previewRole && <RolePreviewBanner previewRole={previewRole} />}
      {impersonation && <ImpersonationBanner adminNom={impersonation.adminNom} adminPrenoms={impersonation.adminPrenoms} targetNom={impersonation.targetNom} targetPrenoms={impersonation.targetPrenoms} targetRole={impersonation.targetRole} />}
      <div className="page-container" style={{ maxWidth: 560 }}>
        <a href="/documents" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Documents</a>
        <h2 style={{ margin: '10px 0 4px', color: 'var(--abed-green)' }}>Nouveau document</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
          Partez d&apos;une page vierge ou importez un Word (.docx) — le contenu est éditable pour la révision collaborative (commentaires, corrections en direct).
        </p>
        <NouveauDocumentForm />
      </div>
    </>
  )
}
