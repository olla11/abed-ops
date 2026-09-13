'use client'
import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'

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
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    fetch(`/api/execution-financiere?annee=${annee}`).then(r => r.json()).then(j => {
      setLignes(j.lignes ?? [])
      setTotaux(j.totaux ?? { budgetAnnuel: 0, totalDepense: 0, disponible: 0 })
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [annee])

  async function importerFichier(file: File) {
    setImporting(true); setImportMsg('')
    const form = new FormData()
    form.append('file', file)
    form.append('annee', String(annee))
    const res = await fetch('/api/budget-adopte/import', { method: 'POST', body: form })
    const j = await res.json()
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    if (!res.ok) { setImportMsg('Erreur : ' + j.error); return }
    setImportMsg(`${j.importes} ligne(s) importée(s)${j.ignores?.length ? ` — ignoré(es) : ${j.ignores.join(', ')}` : ''}.`)
    load()
  }

  const pctGlobal = totaux.budgetAnnuel > 0 ? (totaux.totalDepense / totaux.budgetAnnuel) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Année</label>
        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={{ ...inputStyle, width: 100 }}>
          {[anneeCourante - 1, anneeCourante, anneeCourante + 1, anneeCourante + 2].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ width: 1, height: 20, background: 'var(--abed-border)' }} />
        <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Budget adopté {annee} :</span>
        <a href={`/api/budget-adopte/template?annee=${annee}`} className="btn secondary" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          Télécharger le modèle Excel
        </a>
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) importerFichier(f) }} />
        <button className="btn" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => fileRef.current?.click()} disabled={importing}>
          <Upload size={14} /> {importing ? 'Import…' : 'Importer le fichier complété'}
        </button>
      </div>
      {importMsg && <p style={{ fontSize: 12, color: importMsg.startsWith('Erreur') ? '#dc2626' : '#166534', marginBottom: 12 }}>{importMsg}</p>}

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
          <table style={{ minWidth: 1240, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 64 }} />
              <col style={{ width: 300 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 160 }} />
            </colgroup>
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
                <th>% Exécution</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.code} style={l.estRubrique ? { background: '#f0fdf4' } : undefined}>
                  <td style={{ fontSize: 11, color: 'var(--abed-muted)', fontWeight: l.estRubrique ? 800 : 400 }}>{l.code}</td>
                  <td style={{
                    fontSize: 13, fontWeight: l.estRubrique ? 800 : 400,
                    color: l.estRubrique ? 'var(--abed-green)' : '#111827',
                    whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', lineHeight: 1.35,
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
