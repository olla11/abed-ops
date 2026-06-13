'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ROLES = [
  {
    key: 'missionnaire',
    label: 'Missionnaire',
    color: '#6b7280',
    bg: '#f9fafb',
    description: "Acces a ses propres ordres de mission, timesheets, demandes de paiement et conges.",
    acces: ['Mon espace (OM, Timesheet, Demandes, Conges)', 'Statut de ses dossiers'],
  },
  {
    key: 'prestataire',
    label: 'Prestataire',
    color: '#6b7280',
    bg: '#f9fafb',
    description: "Identique au missionnaire — acces limite a ses propres documents.",
    acces: ['Mon espace (OM, Timesheet, Demandes, Conges)', 'Statut de ses dossiers'],
  },
  {
    key: 'manager',
    label: 'Manager',
    color: '#1d4ed8',
    bg: '#eff6ff',
    description: "Peut approuver les conges de son equipe (validation N1).",
    acces: ['Mon espace', 'Statut', 'Validation conges N1'],
  },
  {
    key: 'aaf',
    label: 'AAF',
    color: '#7c3aed',
    bg: '#f5f3ff',
    description: "Acces a la vue d'ensemble des missions et dossiers.",
    acces: ["Mon espace", "Statut", "Vue d'ensemble"],
  },
  {
    key: 'caf',
    label: 'CAF',
    color: '#b45309',
    bg: '#fffbeb',
    description: "Comptable/CAF : valide les demandes de paiement, acces a la vue d'ensemble et au module RH.",
    acces: ["Mon espace", "Statut", "Vue d'ensemble", "RH (lecture)", "Creation de comptes"],
  },
  {
    key: 'rh',
    label: 'RH',
    color: '#0f766e',
    bg: '#f0fdfa',
    description: "Gestion du personnel, contrats, conges, evaluations. Peut creer des comptes.",
    acces: ["Mon espace", "Statut", "RH complet (Personnel, Contrats, Conges, Evaluations)"],
  },
  {
    key: 'de',
    label: 'Directeur Executif',
    color: '#16a34a',
    bg: '#f0fdf4',
    description: "Signe les ordres de mission, valide les documents, acces a la vue d'ensemble complete.",
    acces: ["Mon espace", "Statut", "Vue d'ensemble", "Signature OM et PDF"],
  },
  {
    key: 'administrateur',
    label: 'Administrateur (CA)',
    color: '#15803d',
    bg: '#f0fdf4',
    description: "Membre du CA — acces a la vue d'ensemble pour supervision.",
    acces: ["Mon espace", "Statut", "Vue d'ensemble"],
  },
  {
    key: 'admin',
    label: 'Admin systeme',
    color: '#dc2626',
    bg: '#fef2f2',
    description: "Acces total : toutes les pages, tous les modules, gestion des comptes et parametres.",
    acces: ["Tout"],
  },
]

export default function RolesClient({
  currentPreview,
  roleCounts,
}: {
  currentPreview: string | null
  roleCounts: Record<string, number>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function simulate(role: string) {
    setLoading(role)
    await fetch('/api/admin/role-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role === 'admin' ? null : role }),
    })
    setLoading(null)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Roles &amp; Permissions</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Simulez un role pour voir l&apos;interface telle qu&apos;un utilisateur la voit.
          Une banniere orange s&apos;affiche en bas de l&apos;ecran pour quitter la simulation.
        </p>
      </div>

      {currentPreview && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#92400e',
        }}>
          Simulation active : <strong>{ROLES.find(r => r.key === currentPreview)?.label ?? currentPreview}</strong>
          {' — '}
          <button onClick={() => simulate('admin')} style={{
            background: 'none', border: 'none', color: '#dc2626', fontWeight: 700,
            cursor: 'pointer', padding: 0, fontSize: 14,
          }}>
            Quitter la simulation
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {ROLES.map(r => {
          const isActive = currentPreview === r.key || (!currentPreview && r.key === 'admin')
          const count = roleCounts[r.key] ?? 0

          return (
            <div key={r.key} className="card" style={{
              border: isActive ? `2px solid ${r.color}` : '1px solid var(--abed-border)',
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                    background: r.bg, color: r.color, fontWeight: 700, fontSize: 13,
                    marginBottom: 6,
                  }}>
                    {r.label}
                  </span>
                  {count > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 8 }}>
                      {count} utilisateur{count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span style={{ fontSize: 11, color: r.color, fontWeight: 700 }}>ACTIF</span>
                )}
              </div>

              <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', lineHeight: 1.5 }}>
                {r.description}
              </p>

              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--abed-muted)', margin: '0 0 4px' }}>Acces :</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {r.acces.map(a => (
                    <li key={a} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>{a}</li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => simulate(r.key)}
                disabled={loading !== null || isActive}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${r.color}`,
                  background: isActive ? r.bg : 'white',
                  color: r.color,
                  cursor: isActive || loading !== null ? 'default' : 'pointer',
                  opacity: loading === r.key ? 0.6 : 1,
                }}
              >
                {loading === r.key ? 'Chargement...' : isActive ? 'Vue active' : 'Simuler ce role'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
