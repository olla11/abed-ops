'use client'
import Link from 'next/link'
import { useState, useMemo } from 'react'

type Profile = { id: string; nom: string; prenoms: string }
type Contrat = { id: string; type_contrat: string; date_fin: string | null; poste: string | null }
type Evaluation = {
  id: string
  statut: string
  declenchee_le: string
  score_moyen: number | null
  profile: Profile | null
  contrat: Contrat | null
}
type ContratActif = {
  id: string
  type_contrat: string
  date_fin: string | null
  poste: string | null
  profile: Profile | null
}

type Props = {
  evaluations: Evaluation[]
  contratsActifs: ContratActif[]
}

const STATUTS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  en_attente:           { label: 'En attente',           color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  evaluateur_complete:  { label: 'Évaluateur complété',  color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  evalue_complete:      { label: 'Évalué complété',      color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff' },
  responsable_complete: { label: 'Responsable signé',    color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  cloture:              { label: 'Clôturé',              color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
}

function BadgeStatut({ statut }: { statut: string }) {
  const s = STATUTS[statut] ?? { label: statut, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' }
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

export default function EvaluationsRHClient({ evaluations: initial, contratsActifs }: Props) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>(initial)
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreMois, setFiltreMois] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedContrat, setSelectedContrat] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return evaluations.filter(e => {
      if (filtreStatut && e.statut !== filtreStatut) return false
      if (filtreMois) {
        const mois = e.declenchee_le?.substring(0, 7)
        if (mois !== filtreMois) return false
      }
      return true
    })
  }, [evaluations, filtreStatut, filtreMois])

  async function handleDeclencher() {
    if (!selectedContrat) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/rh/evaluations/declencher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrat_id: selectedContrat }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erreur'); return }
      setSuccess('Évaluation déclenchée avec succès.')
      setShowModal(false)
      setSelectedContrat('')
      // Refresh
      const r2 = await fetch('/api/rh/evaluations')
      if (r2.ok) {
        const d2 = await r2.json()
        setEvaluations(d2.evaluations ?? d2 ?? [])
      }
      // fallback: reload
      window.location.reload()
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  async function handleDeclencherAuto() {
    setLoading(true); setErr(null); setSuccess(null)
    try {
      const res = await fetch('/api/rh/evaluations/declencher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erreur'); return }
      const n = data.resultats?.filter((r: string) => r.includes('créée')).length ?? 0
      setSuccess(`Déclenchement automatique: ${n} évaluation(s) créée(s).`)
      window.location.reload()
    } catch { setErr('Erreur réseau') }
    finally { setLoading(false) }
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid var(--abed-border)',
    borderRadius: 6, fontSize: 14, boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--abed-border)', fontSize: 13 }}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input type="month" value={filtreMois} onChange={e => setFiltreMois(e.target.value)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--abed-border)', fontSize: 13 }} />
          {(filtreStatut || filtreMois) && (
            <button onClick={() => { setFiltreStatut(''); setFiltreMois('') }} style={{ fontSize: 13, color: 'var(--abed-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Réinitialiser</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDeclencherAuto} disabled={loading} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--abed-border)', background: 'white', color: '#374151',
          }}>
            {loading ? '⏳...' : '🔄 Auto 30j'}
          </button>
          <button onClick={() => setShowModal(true)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'var(--abed-green)', color: 'white', border: 'none',
          }}>
            + Déclencher évaluation
          </button>
        </div>
      </div>

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#166534' }}>
          {success}
        </div>
      )}
      {err && (
        <div style={{ background: '#fdf0f0', border: '1px solid #f5b7b1', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#c0392b' }}>
          {err}
        </div>
      )}

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employé', 'Poste', 'Type contrat', 'Fin contrat', 'Déclenché le', 'Statut', 'Score', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#6b7280', borderBottom: '1px solid var(--abed-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--abed-muted)' }}>Aucune évaluation</td></tr>
            )}
            {filtered.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--abed-border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                  {e.profile?.prenoms} {e.profile?.nom}
                </td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{e.contrat?.poste ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ background: '#f3f4f6', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                    {e.contrat?.type_contrat ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                  {e.contrat?.date_fin ?? '—'}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151', fontSize: 13 }}>
                  {e.declenchee_le ? new Date(e.declenchee_le).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}><BadgeStatut statut={e.statut} /></td>
                <td style={{ padding: '10px 14px' }}>
                  {e.score_moyen != null ? (
                    <span style={{
                      fontWeight: 700, fontSize: 15,
                      color: e.score_moyen >= 4 ? '#166534' : e.score_moyen >= 3 ? '#92400e' : '#991b1b',
                    }}>
                      {Number(e.score_moyen).toFixed(1)}/5
                    </span>
                  ) : <span style={{ color: '#9ca3af' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <Link href={`/evaluations/${e.id}`} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    background: '#f0fdf4', color: 'var(--abed-green)', border: '1px solid #bbf7d0',
                    textDecoration: 'none', display: 'inline-block',
                  }}>
                    👁 Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal déclencher */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, width: '100%', maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--abed-green)' }}>📝 Déclencher une évaluation</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sélectionner un contrat actif *</label>
              <select value={selectedContrat} onChange={e => setSelectedContrat(e.target.value)} style={inputStyle}>
                <option value="">— Choisir un contrat —</option>
                {contratsActifs.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.profile?.prenoms} {c.profile?.nom} — {c.type_contrat} — Fin: {c.date_fin ?? 'N/A'}
                  </option>
                ))}
              </select>
            </div>
            {err && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setSelectedContrat(''); setErr(null) }} style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                background: 'white', border: '1px solid var(--abed-border)', color: '#374151',
              }}>
                Annuler
              </button>
              <button onClick={handleDeclencher} disabled={!selectedContrat || loading} style={{
                padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: 'var(--abed-green)', color: 'white', border: 'none',
                opacity: !selectedContrat || loading ? 0.6 : 1,
              }}>
                {loading ? 'Déclenchement...' : 'Déclencher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
