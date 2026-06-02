export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SoumissionForm from '@/components/SoumissionForm'
import ValidationManager from '@/components/ValidationManager'
import AppHeader from '@/components/AppHeader'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, nom, prenoms, manager_id, type_emploi').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const estManager = ['manager', 'caf', 'admin'].includes(role)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 24 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={['admin', 'rh', 'caf'].includes(role)}
      />
      <h1 style={{ color: 'var(--abed-green)' }}>Timesheets &amp; livrables</h1>

      {profile?.manager_id ? (
        <SoumissionForm managerId={profile.manager_id} />
      ) : (
        <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
          <p>Aucun responsable direct n'est défini sur votre profil. Contactez l'administration
          pour qu'un manager vous soit attribué avant de soumettre.</p>
        </div>
      )}

      {estManager && <ValidationManager />}
    </div>
  )
}