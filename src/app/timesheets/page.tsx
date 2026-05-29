export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SoumissionForm from '@/components/SoumissionForm'
import ValidationManager from '@/components/ValidationManager'

export default async function TimesheetsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, manager_id, type_emploi').eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const estManager = ['manager', 'caf', 'admin'].includes(role)
  const estPrestataire = ['prestataire_direct', 'prestataire_credit'].includes(profile?.type_emploi ?? '')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 24 }}>
      <h1 style={{ color: 'var(--abed-green)' }}>Timesheets & livrables</h1>

      {/* Tout le monde peut soumettre ; pertinent surtout pour les prestataires */}
      {profile?.manager_id ? (
        <SoumissionForm managerId={profile.manager_id} />
      ) : (
        <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
          <p>Aucun responsable direct n'est défini sur votre profil. Contactez l'administration
          pour qu'un manager vous soit attribué avant de soumettre.</p>
        </div>
      )}

      {/* Les managers voient la file de validation */}
      {estManager && <ValidationManager />}
    </div>
  )
}
