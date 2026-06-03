export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SoumissionForm from '@/components/SoumissionForm'
import ValidationManager from '@/components/ValidationManager'
import ValidationCAF from '@/components/ValidationCAF'
import AppHeader from '@/components/AppHeader'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, manager_id')
    .eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const estManager = ['manager', 'caf', 'admin', 'de'].includes(role)
  const estCAF = ['caf', 'admin'].includes(role)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        showAdmin={['admin', 'caf'].includes(role)}
      />

      <h1 style={{ color: 'var(--abed-green)', marginBottom: 0 }}>Timesheets &amp; livrables</h1>

      {/* Prestataire : formulaire de soumission (si responsable assigné) */}
      {profile?.manager_id ? (
        <SoumissionForm managerId={profile.manager_id} />
      ) : !estManager && !estCAF ? (
        <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
          <p style={{ fontSize: 14 }}>
            Aucun responsable direct n'est défini sur votre profil.
            Contactez l'administration pour qu'un manager vous soit attribué avant de soumettre.
          </p>
        </div>
      ) : null}

      {/* Manager : validation technique (Excel + livrable) */}
      {estManager && <ValidationManager />}

      {/* CAF : validation financière (facture) */}
      {estCAF && <ValidationCAF />}
    </div>
  )
}
