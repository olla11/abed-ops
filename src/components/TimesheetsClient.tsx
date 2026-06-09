'use client'
import { useState } from 'react'
import TabBar from './TabBar'
import SoumissionForm from './SoumissionForm'
import ValidationManager from './ValidationManager'
import ValidationCAF from './ValidationCAF'
import RapportAllocationForm from './RapportAllocationForm'
import ValidationRapportsAAF from './ValidationRapportsAAF'
import GestionCAF from './GestionCAF'

type Props = {
  role: string
  typeEmploi: string | null
  managerId: string | null
  estRapportMensuel: boolean
  estManager: boolean
  estCAF: boolean
  estAAF: boolean
  estSalarie: boolean
}

export default function TimesheetsClient({
  role, typeEmploi, managerId,
  estRapportMensuel, estManager, estCAF, estAAF, estSalarie,
}: Props) {
  const estPrestataire = ['prestataire_direct', 'prestataire_credit'].includes(typeEmploi ?? '')
  const hasOwnForm = estRapportMensuel || estPrestataire
  const hasValidation = estManager || estAAF || estCAF || ['de', 'administrateur'].includes(role)

  const tabs = []
  if (hasOwnForm) tabs.push({ key: 'mes', label: estRapportMensuel ? 'Mon rapport mensuel' : 'Mon timesheet' })
  if (hasValidation) tabs.push({ key: 'valider', label: 'À valider' })
  if (estCAF) tabs.push({ key: 'params', label: '⚙️ Paramètres' })

  const defaultTab = hasOwnForm ? 'mes' : hasValidation ? 'valider' : 'params'
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ color: 'var(--abed-green)', marginBottom: 6 }}>
          {estRapportMensuel ? 'Rapport mensuel' : 'Timesheet & livrables'}
        </h1>
        {estRapportMensuel && (
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
            {estSalarie
              ? "Soumettez votre rapport mensuel. L'AAF génèrera votre fiche de paie, validée par la CAF et autorisée par le DE."
              : "Soumettez votre rapport mensuel. Une fois validé (AAF → CAF → DE), vous recevrez votre état de paiement d'allocation."}
          </p>
        )}
      </div>

      {tabs.length > 1 && (
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      )}

      {/* ── Onglet : mes soumissions ── */}
      {(activeTab === 'mes' || tabs.length === 1 && !hasValidation) && hasOwnForm && (
        <div style={{ display: 'grid', gap: 20 }}>
          {estRapportMensuel && <RapportAllocationForm typeEmploi={typeEmploi} />}
          {estPrestataire && (
            managerId
              ? <SoumissionForm managerId={managerId} typeEmploi={typeEmploi} />
              : <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
                  <p style={{ fontSize: 14 }}>
                    Aucun responsable direct n'est défini sur votre profil.
                    Contactez l'administration pour qu'un manager vous soit attribué avant de soumettre.
                  </p>
                </div>
          )}
        </div>
      )}

      {/* ── Onglet : à valider ── */}
      {(activeTab === 'valider' || (tabs.length === 1 && !hasOwnForm)) && hasValidation && (
        <div style={{ display: 'grid', gap: 20 }}>
          {estManager && (
            <div>
              <h3 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Validation technique — Timesheets</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                Timesheets soumis par vos collaborateurs, en attente de votre validation.
              </p>
              <ValidationManager />
            </div>
          )}

          {(estAAF || estCAF || ['de', 'administrateur'].includes(role)) && (
            <div>
              <h3 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Validation — Rapports d'allocations</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                Rapports mensuels (bénévoles, stagiaires, salariés) en attente de validation.
              </p>
              <ValidationRapportsAAF role={role} />
            </div>
          )}

          {estCAF && (
            <div>
              <h3 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Validation financière CAF</h3>
              <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
                Vérification des montants et validation financière des timesheets.
              </p>
              <ValidationCAF />
            </div>
          )}
        </div>
      )}

      {/* ── Onglet : paramètres (CAF seulement) ── */}
      {activeTab === 'params' && estCAF && (
        <GestionCAF />
      )}

      {/* Cas utilisateur sans formulaire ni validation */}
      {!hasOwnForm && !hasValidation && !estCAF && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--abed-muted)' }}>
            Aucune action disponible pour votre profil sur cette page.
          </p>
        </div>
      )}
    </div>
  )
}
