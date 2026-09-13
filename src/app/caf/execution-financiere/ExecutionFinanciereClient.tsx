'use client'
import { useEffect, useState } from 'react'

type Ligne = {
  code: string
  libelle: string
  estRubrique: boolean
  budgetAnnuel: number
  depenseT1: number
  depenseT2: number
  depenseT3: number
  depenseT4: number
  totalDepense: number
  disponible: number
  pctExecution: number
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, fontSize: 12.5,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('fr-FR')
}

function barColor(pct: number) {
  if (pct >= 100) return '#dc2626'
  if (pct >= 80) return '#e08e00'
  return 'var(--abed-green)'
}

export default function ExecutionFinanciereClient() {
  const anneeCourante = new Date().getFullYear()
  const [annee, setAnnee] = useState(anneeCourante)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [totaux, setTotaux] = useState({ budgetAnnuel: 0, totalDepense: 0, disponible: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/execution-financiere?annee=${annee}`).then(r => r.json()).then(j => {
      setLignes(j.lignes ?? [])
      setTotaux(j.totaux ?? { budgetAnnuel: 0, totalDepense: 0, disponible: 0 })
    }).finally(() => setLoading(false))
  }, [annee])

  const pctGlobal = totaux.budgetAnnuel > 0 ? (totaux.totalDepense / totaux.budgetAnnuel) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Année</label>
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={{ ...inputStyle, width: 100 }}>
          {[anneeCourante - 1, anneeCourante, anneeCourante + 1].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Budget adopté</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{fmt(totaux.budgetAnnuel)} FCFA</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Dépensé (payé)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: barColor(pctGlobal) }}>{fmt(totaux.totalDepense)} FCFA</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Disponible</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{fmt(totaux.disponible)} FCFA</div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Exécution globale</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: barColor(pctGlobal) }}>{pctGlobal.toFixed(1)}%</div>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Ligne budgétaire</th>
                <th>Budget adopté</th>
                <th>T1</th>
                <th>T2</th>
                <th>T3</th>
                <th>T4</th>
                <th>Total dépensé</th>
                <th>Disponible</th>
                <th style={{ minWidth: 140 }}>% Exécution</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.code} style={l.estRubrique ? { background: '#f0fdf4' } : undefined}>
                  <td style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: l.estRubrique ? 800 : 400 }}>{l.code}</td>
                  <td style={{
                    fontSize: l.estRubrique ? 13.5 : 13, fontWeight: l.estRubrique ? 800 : 400,
                    color: l.estRubrique ? 'var(--abed-green)' : '#111827',
                    textTransform: l.estRubrique ? 'uppercase' : 'none',
                    whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', minWidth: 240,
                  }}>{l.libelle}</td>
                  <td style={{ fontWeight: l.estRubrique ? 800 : 600, whiteSpace: 'nowrap' }}>{l.budgetAnnuel ? fmt(l.budgetAnnuel) : '—'}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.depenseT1 ? fmt(l.depenseT1) : '—'}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.depenseT2 ? fmt(l.depenseT2) : '—'}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.depenseT3 ? fmt(l.depenseT3) : '—'}</td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.depenseT4 ? fmt(l.depenseT4) : '—'}</td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(l.totalDepense)}</td>
                  <td style={{ whiteSpace: 'nowrap', color: l.disponible < 0 ? '#dc2626' : '#111827' }}>{l.budgetAnnuel || l.disponible ? fmt(l.disponible) : '—'}</td>
                  <td>
                    {l.budgetAnnuel > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, l.pctExecution)}%`, height: '100%', background: barColor(l.pctExecution) }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: barColor(l.pctExecution), minWidth: 40, textAlign: 'right' }}>
                          {l.pctExecution.toFixed(1)}%
                        </span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--abed-muted)', padding: 24 }}>Aucun code budgétaire.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
