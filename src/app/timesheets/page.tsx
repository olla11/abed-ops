export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SoumissionForm from '@/components/SoumissionForm'
import ValidationManager from '@/components/ValidationManager'
import ValidationCAF from '@/components/ValidationCAF'
import RapportAllocationForm from '@/components/RapportAllocationForm'
import ValidationRapportsAAF from '@/components/ValidationRapportsAAF'
import GestionCAF from '@/components/GestionCAF'
import AppHeader from '@/components/AppHeader'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, manager_id, type_emploi, email')
    .eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const typeEmploi = profile?.type_emploi ?? null
  const estRapportMensuel = ['benevole', 'stagiaire_n1', 'stagiaire_n2', 'cdd', 'cdi'].includes(typeEmploi ?? '')
  const estManager = ['manager', 'caf', 'admin', 'de', 'aaf'].includes(role)
  const estCAF = ['caf', 'admin'].includes(role)
  const estAAF = ['aaf', 'admin'].includes(role)
  const estSalarie = ['cdd', 'cdi'].includes(typeEmploi ?? '')

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={typeEmploi}
        showAdmin={role === 'admin'}
      />

      {/* Titre dynamique pour les non-gestionnaires */}
      {!estManager && !estCAF && (
        <div>
          <h1 style={{ color: 'var(--abed-green)', marginBottom: 6 }}>
            {estRapportMensuel ? 'Rapport mensuel' : 'Timesheet & livrables'}
          </h1>
          {estRapportMensuel && (
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
              {estSalarie
                ? "Soumettez votre rapport mensuel. L'AAF génèrera votre fiche de paie, validée par la CAF et autorisée par le DE."
                : "Soumettez votre rapport mensuel. Une fois validé (AAF → CAF → DE), vous recevrez votre état de paiement d'allocation par email."}
            </p>
          )}
        </div>
      )}

      {/* Bénévole / Stagiaire / CDD / CDI : rapport mensuel — affiché sans condition de manager */}
      {estRapportMensuel && !estManager && !estCAF && (
        <RapportAllocationForm typeEmploi={typeEmploi} />
      )}

      {/* Prestataire direct/crédit : formulaire timesheet */}
      {!estRapportMensuel && !estManager && !estCAF && (
        profile?.manager_id
          ? <SoumissionForm managerId={profile.manager_id} typeEmploi={profile.type_emploi} />
          : <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
              <p style={{ fontSize: 14 }}>
                Aucun responsable direct n'est défini sur votre profil.
                Contactez l'administration pour qu'un manager vous soit attribué avant de soumettre.
              </p>
            </div>
      )}

      {/* Manager : validation technique */}
      {estManager && <ValidationManager />}

      {/* AAF/CAF/DE : validation des rapports d'allocations */}
      {(estAAF || estCAF || ['de', 'administrateur'].includes(role)) && <ValidationRapportsAAF role={role} />}

      {/* CAF : validation financière */}
      {estCAF && <ValidationCAF />}

      {/* CAF : paramètres financiers (taux + listes formulaires) */}
      {estCAF && <GestionCAF />}
    </div>
  )
}
