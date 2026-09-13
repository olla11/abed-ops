'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

type CompteBancaire = { id: string; nom: string }
type AppelDeFonds = { id: string; numero: string; statut: string }
type PayRollItem = {
  id: string
  source_type: string
  reference: string | null
  beneficiaire_nom: string
  objet: string
  montant: number
  statut: 'non_paye' | 'a_payer' | 'paye'
  compte_bancaire: CompteBancaire | null
  appel_de_fonds: AppelDeFonds | null
  paye_le: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  demande_paiement: 'Demande de paiement',
  rapport_allocation: 'Allocation',
  reconciliation_mission: 'Réconciliation mission',
  timesheet: 'Timesheet',
}

export default function AAFPayRollClient() {
  const [items, setItems] = useState<PayRollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [showPayes, setShowPayes] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/pay-roll').then(r => r.json()).then(j => setItems(j.data ?? [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function marquerPaye(id: string) {
    if (!confirm('Confirmer le paiement de cette ligne ? Le bénéficiaire recevra un email de notification.')) return
    setPayingId(id); setErr('')
    const res = await fetch(`/api/pay-roll/${id}/marquer-paye`, { method: 'POST' })
    const j = await res.json()
    setPayingId(null)
    if (!res.ok) { setErr(j.error ?? 'Erreur'); return }
    load()
  }

  const aTraiter = items.filter(i => i.statut === 'a_payer' && i.appel_de_fonds?.statut === 'signe')
  const dejaPayes = items.filter(i => i.statut === 'paye')
  const visibles = showPayes ? dejaPayes : aTraiter

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowPayes(false)} style={{
          padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          border: '1.5px solid', borderColor: !showPayes ? 'var(--abed-green)' : 'var(--abed-border)',
          background: !showPayes ? '#f0fdf4' : 'white', color: !showPayes ? 'var(--abed-green)' : '#374151',
        }}>
          À payer ({aTraiter.length})
        </button>
        <button onClick={() => setShowPayes(true)} style={{
          padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          border: '1.5px solid', borderColor: showPayes ? 'var(--abed-green)' : 'var(--abed-border)',
          background: showPayes ? '#f0fdf4' : 'white', color: showPayes ? 'var(--abed-green)' : '#374151',
        }}>
          Déjà payés ({dejaPayes.length})
        </button>
      </div>

      {err && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Chargement…</p>
      ) : visibles.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          {showPayes ? 'Aucun paiement effectué pour le moment.' : "Rien à payer pour l'instant — en attente d'appels de fonds signés."}
        </div>
      ) : (
        <div className="table-wrap">
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Source</th>
                <th>Bénéficiaire</th>
                <th>Objet</th>
                <th>Montant</th>
                <th>Compte</th>
                <th>Appel de fonds</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(item => (
                <tr key={item.id} style={{ opacity: payingId === item.id ? 0.6 : 1 }}>
                  <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{item.reference ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{SOURCE_LABELS[item.source_type] ?? item.source_type}</td>
                  <td style={{ fontWeight: 600 }}>{item.beneficiaire_nom}</td>
                  <td style={{ fontSize: 13, maxWidth: 260 }}>{item.objet}</td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(item.montant).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{ fontSize: 13 }}>{item.compte_bancaire?.nom ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{item.appel_de_fonds?.numero ?? '—'}</td>
                  <td>
                    {showPayes ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                        <CheckCircle2 size={15} /> Payé
                      </span>
                    ) : (
                      <button className="btn" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => marquerPaye(item.id)} disabled={payingId === item.id}>
                        {payingId === item.id ? '…' : 'Marquer payé'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
