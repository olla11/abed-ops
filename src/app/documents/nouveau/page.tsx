export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { getEffectiveRole } from '@/lib/role-preview'
import { estRH, estAAF } from '@/lib/roles'
import NouveauDocumentForm from './NouveauDocumentForm'

export default async function NouveauDocumentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()
  const role = await getEffectiveRole(profile?.role ?? 'missionnaire')

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showRH={estRH(role)}
        showAAF={estAAF(role)}
        avatarUrl={profile?.avatar_url ?? null}
      />
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
