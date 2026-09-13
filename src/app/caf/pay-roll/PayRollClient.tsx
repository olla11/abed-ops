'use client'
import { useEffect, useState } from 'react'

type CompteBancaire = { id: string; nom: string }
type CodeBudgetaire = { code: string; libelle: string }
type PayRollItem = {
  id: string
  source_type: string
  reference: string | null
  beneficiaire_nom: string
  objet: string
  code_budgetaire: string | null
  montant: number
  statut: 'non_paye' | 'a_payer' | 'paye'
  compte_bancaire_id: string | null
  compte_bancaire: CompteBancaire | null
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  demande_paiement: 'Demande de paiement',
  rapport_allocation: 'Allocation',
  reconciliation_mission: 'Réconciliation mission',
  timesheet: 'Timesheet',
}

const STATUT_LABELS: Record<string, string> = { non_paye: 'Non payé', a_payer: 'À payer', paye: 'Payé' }
const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  non_paye: { bg: '#fef2f2', color: '#991b1b' },
  a_payer: { bg: '#fffbeb', color: '#92400e' },
  paye: { bg: '#f0fdf4', color: '#16a34a' },
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 6, fontSize: 12.5,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const FILTRES: { key: 'tous' | 'non_paye' | 'a_payer' | 'paye'; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'non_paye', label: 'Non payé' },
  { key: 'a_payer', label: 'À payer' },
  { key: 'paye', label: 'Payé' },
]

export default function PayRollClient() {
  const [items, setItems] = useState<PayRollItem[]>([])
  const [comptes, setComptes] = useState<CompteBancaire[]>([])
  const [codes, setCodes] = useState<CodeBudgetaire[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'tous' | 'non_paye' | 'a_payer' | 'paye'>('non_paye')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/pay-roll').then(r => r.json()).then(j => setItems(j.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/config/listes?type=comptes_bancaires').then(r => r.json()).then(j => setComptes(j.data ?? []))
    fetch('/api/config/listes?type=codes_budgetaires').then(r => r.json()).then(j => setCodes(j.data ?? []))
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id); setErr('')
    const res = await fetch(`/api/pay-roll/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await res.json()
    setSavingId(null)
    if (!res.ok) { setErr(j.error ?? 'Erreur'); return }
    load()
  }

  const visibles = filtre === 'tous' ? items : items.filter(i => i.statut === filtre)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTRES.map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key)} style={{
            padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: '1.5px solid', borderColor: filtre === f.key ? 'var(--abed-green)' : 'var(--abed-border)',
            background: filtre === f.key ? '#f0fdf4' : 'white',
            color: filtre === f.key ? 'var(--abed-green)' : '#374151',
          }}>
            {f.label} {f.key !== 'tous' && `(${items.filter(i => i.statut === f.key).length})`}
          </button>
        ))}
      </div>

      {err && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : visibles.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Aucun paiement ici pour le moment.
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Source</th>
                <th>Bénéficiaire</th>
                <th>Objet</th>
                <th>Code budgétaire</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Compte</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(item => {
                const dejaPaye = item.statut === 'paye'
                return (
                  <tr key={item.id} style={{ opacity: savingId === item.id ? 0.6 : 1 }}>
                    <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{item.reference ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{SOURCE_LABELS[item.source_type] ?? item.source_type}</td>
                    <td style={{ fontWeight: 600 }}>{item.beneficiaire_nom}</td>
                    <td style={{ fontSize: 13, maxWidth: 260 }}>{item.objet}</td>
                    <td>
                      <select
                        style={{ ...inputStyle, minWidth: 160 }}
                        value={item.code_budgetaire ?? ''}
                        disabled={dejaPaye || savingId === item.id}
                        onChange={e => patch(item.id, { code_budgetaire: e.target.value })}
                      >
                        <option value="">— Choisir —</option>
                        {codes.map(c => <option key={c.code} value={c.code}>{c.code} — {c.libelle}</option>)}
                      </select>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(item.montant).toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <select
                        style={{
                          ...inputStyle, fontWeight: 700, minWidth: 110,
                          background: STATUT_COLORS[item.statut]?.bg, color: STATUT_COLORS[item.statut]?.color,
                          border: 'none',
                        }}
                        value={item.statut}
                        disabled={dejaPaye || savingId === item.id}
                        onChange={e => patch(item.id, { statut: e.target.value })}
                      >
                        <option value="non_paye">{STATUT_LABELS.non_paye}</option>
                        <option value="a_payer">{STATUT_LABELS.a_payer}</option>
                        {dejaPaye && <option value="paye">{STATUT_LABELS.paye}</option>}
                      </select>
                    </td>
                    <td>
                      <select
                        style={{ ...inputStyle, minWidth: 140 }}
                        value={item.compte_bancaire_id ?? ''}
                        disabled={dejaPaye || savingId === item.id}
                        onChange={e => patch(item.id, { compte_bancaire_id: e.target.value })}
                      >
                        <option value="">— Choisir —</option>
                        {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
