'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const SoumissionForm = dynamic(() => import('@/components/SoumissionForm'), { ssr: false })
const ValidationManager = dynamic(() => import('@/components/ValidationManager'), { ssr: false })
const ValidationCAF = dynamic(() => import('@/components/ValidationCAF'), { ssr: false })
const RapportAllocationForm = dynamic(() => import('@/components/RapportAllocationForm'), { ssr: false })
const ValidationRapportsAAF = dynamic(() => import('@/components/ValidationRapportsAAF'), { ssr: false })

type Tab = {
  key: string
  icon: string
  label: string
  desc: string
  count?: number
  color?: string
}

type Props = {
  role: string
  typeEmploi: string | null
  managerId: string | null
  hasManager: boolean
  // pending counts
  countTimesheetsAValider: number
  countTimesheetsCAF: number
  countRapportsAAF: number
  countRapportsCAF: number
  countRapportsDE: number
}

export default function TimesheetsClient({
  role, typeEmploi, managerId, hasManager,
  countTimesheetsAValider, countTimesheetsCAF,
  countRapportsAAF, countRapportsCAF, countRapportsDE,
}: Props) {

  const estRapportMensuel = ['benevole', 'stagiaire_n1', 'stagiaire_n2', 'cdd', 'cdi'].includes(typeEmploi ?? '')
  const estPrestataire = ['prestataire_direct', 'prestataire_credit'].includes(typeEmploi ?? '')
  const estSalarie = ['cdd', 'cdi'].includes(typeEmploi ?? '')
  const estManager = ['manager', 'caf', 'admin', 'de', 'aaf'].includes(role)
  const estCAF = ['caf', 'admin'].includes(role)
  const estAAF = ['aaf', 'admin'].includes(role)
  const estDE = ['de', 'administrateur'].includes(role)

  // Construire les onglets selon les droits
  const tabs: Tab[] = []

  // Soumission personnelle
  if (estPrestataire) {
    tabs.push({ key: 'mes_soumissions', icon: '📋', label: 'Mes soumissions', desc: 'Timesheets & livrables' })
  }
  if (estRapportMensuel) {
    tabs.push({ key: 'mon_rapport', icon: '📋', label: 'Mon rapport mensuel', desc: estSalarie ? 'Fiche de paie' : 'Rapport d\'allocation' })
  }

  // Validation CAF financière (priorité haute)
  if (estCAF) {
    tabs.push({
      key: 'caf_timesheets', icon: '💳', label: 'Timesheets & paiements',
      desc: 'Validation financière + paiements',
      count: countTimesheetsCAF, color: countTimesheetsCAF > 0 ? '#1e40af' : undefined,
    })
  }

  // Rapports allocation AAF
  if (estAAF) {
    tabs.push({
      key: 'aaf_rapports', icon: '📑', label: 'Rapports à traiter',
      desc: 'Fixer les montants d\'allocation',
      count: countRapportsAAF, color: countRapportsAAF > 0 ? '#6d28d9' : undefined,
    })
  }

  // Rapports allocation CAF
  if (estCAF) {
    tabs.push({
      key: 'caf_rapports', icon: '📑', label: 'Rapports d\'allocation',
      desc: 'Validation des allocations',
      count: countRapportsCAF, color: countRapportsCAF > 0 ? '#6d28d9' : undefined,
    })
  }

  // Rapports à autoriser DE
  if (estDE) {
    tabs.push({
      key: 'de_rapports', icon: '✅', label: 'Rapports à autoriser',
      desc: 'Autorisation finale DE',
      count: countRapportsDE, color: countRapportsDE > 0 ? '#065f46' : undefined,
    })
  }

  // Validation technique (manager, AAF, CAF, DE, admin)
  if (estManager) {
    const totalTech = countTimesheetsAValider
    tabs.push({
      key: 'validation_tech', icon: '✅', label: 'Validation technique',
      desc: 'Timesheets & rapports soumis',
      count: totalTech, color: totalTech > 0 ? '#b45309' : undefined,
    })
  }

  // Fallback: aucun onglet → accès limité
  if (tabs.length === 0) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
        <p style={{ fontSize: 14 }}>
          Votre profil ne donne pas accès à cette section. Contactez l'administration.
        </p>
      </div>
    )
  }

  // Onglet actif par défaut = premier onglet prioritaire
  const defaultTab = tabs[0].key
  const [activeTab, setActiveTab] = useState(defaultTab)

  const current = tabs.find(t => t.key === activeTab) ?? tabs[0]

  return (
    <div className="page-container">
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>
          Timesheets & Allocations
        </h1>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          {tabs.length > 1
            ? 'Gérez vos soumissions et traitez les demandes selon vos responsabilités.'
            : 'Soumettez et suivez vos rapports.'}
        </p>
      </div>

      {/* Onglets sous forme de cartes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10, marginBottom: 28,
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: active ? 'var(--abed-green)' : 'white',
                border: active ? '2px solid var(--abed-green)' : '2px solid #e5e7eb',
                borderRadius: 14, padding: '14px 16px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
                boxShadow: active ? '0 4px 14px rgba(6,95,70,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{tab.icon}</span>
                {tab.count !== undefined && (
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.25)' : (tab.count > 0 ? '#fef3c7' : '#f3f4f6'),
                    color: active ? 'white' : (tab.count > 0 ? '#92400e' : '#9ca3af'),
                    borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700,
                    border: active ? '1px solid rgba(255,255,255,0.3)' : (tab.count > 0 ? '1px solid #fcd34d' : '1px solid #e5e7eb'),
                  }}>
                    {tab.count}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'white' : '#111827', marginBottom: 2 }}>
                {tab.label}
              </div>
              <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}>
                {tab.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{current.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{current.label}</span>
          {current.count !== undefined && current.count > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700, border: '1px solid #fcd34d' }}>
              {current.count} en attente
            </span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {activeTab === 'mes_soumissions' && (
            hasManager
              ? <SoumissionForm managerId={managerId!} typeEmploi={typeEmploi} />
              : <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '16px 20px' }}>
                  <p style={{ fontSize: 14, color: '#92400e', margin: 0 }}>
                    Aucun responsable direct n'est défini sur votre profil.
                    Contactez l'administration pour qu'un manager vous soit attribué avant de soumettre.
                  </p>
                </div>
          )}
          {activeTab === 'mon_rapport' && <RapportAllocationForm typeEmploi={typeEmploi} />}
          {activeTab === 'caf_timesheets' && <ValidationCAF />}
          {activeTab === 'aaf_rapports' && <ValidationRapportsAAF role="aaf" />}
          {activeTab === 'caf_rapports' && <ValidationRapportsAAF role="caf" />}
          {activeTab === 'de_rapports' && <ValidationRapportsAAF role={role} />}
          {activeTab === 'validation_tech' && <ValidationManager />}
        </div>
      </div>
    </div>
  )
}
