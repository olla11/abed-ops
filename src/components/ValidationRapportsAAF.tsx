'use client'
import { useEffect, useState } from 'react'

type Rapport = {
  id: string; periode_mois: number; periode_annee: number
  rapport_texte: string; montant_allocation: number | null; status: string
  commentaire_manager: string | null
  prestataire: { nom: string; prenoms: string; type_emploi: string | null } | null
}

const STATUS_FOR_AAF = ['valide_tech']
const STATUS_FOR_CAF = ['traite_aaf']
const STATUS_FOR_DE = ['valide_caf']

export default function ValidationRapportsAAF({ role }: { role: string }) {
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [loading, setLoading] = useState(true)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [montantMap, setMontantMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/rapports-allocations')
    const json = await res.json()
    setRapports(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function canAct(r: Rapport) {
    if (['aaf', 'admin'].includes(role)) return STATUS_FOR_AAF.includes(r.status)
    if (role === 'caf') return STATUS_FOR_CAF.includes(r.status)
    if (['de', 'administrateur'].includes(role)) return STATUS_FOR_DE.includes(r.status)
    if (role === 'manager') return r.status === 'soumis'
    return false
  }

  async function agir(id: string, action: string) {
    const commentaire = commentMap[id] ?? ''
    const montant = montantMap[id]
    if (action === 'valider' && ['aaf', 'admin'].includes(role)) {
      if (!montant || +montant <= 0) { alert('Saisissez le montant de l\'allocation.'); return }
    }
    if (action !== 'valider' && action !== 'autoriser' && !commentaire.trim()) {
      alert('Commentaire obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/rapports-allocations/${id}/valider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire, montant_allocation: montant ? +montant : undefined }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  const aTraiter = rapports.filter(canAct)
  if (loading || aTraiter.length === 0) return null

  return (
    <div className="card" style={{ borderLeft: '4px solid #6d28d9' }}>
      <h3 style={{ marginBottom: 4 }}>📋 Rapports d'allocations à traiter ({aTraiter.length})</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
        {['aaf', 'admin'].includes(role) && 'Saisissez le montant de l\'allocation et validez.'}
        {role === 'caf' && 'Vérifiez et validez les rapports traités par l\'AAF.'}
        {['de', 'administrateur'].includes(role) && 'Autorisez les allocations validées par la CAF.'}
      </p>
      {aTraiter.map(r => {
        const isOpen = expanded === r.id
        const mois = new Date(r.periode_annee, r.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        return (
          <div key={r.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : r.id)}>
              <div>
                <strong>{r.prestataire?.prenoms} {r.prestataire?.nom}</strong>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 8 }}>
                  {mois} — {r.prestataire?.type_emploi}
                  {r.montant_allocation != null && (
                    <strong style={{ color: 'var(--abed-green)', marginLeft: 8 }}>
                      {r.montant_allocation.toLocaleString('fr-FR')} XOF
                    </strong>
                  )}
                </span>
              </div>
              <span>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div style={{ background: '#f9fafb', borderRadius: 6, padding: 10 }}>
                  <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.rapport_texte}</p>
                </div>
                {r.commentaire_manager && (
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: '#374151' }}>
                    Manager : {r.commentaire_manager}
                  </p>
                )}
                {['aaf', 'admin'].includes(role) && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">
                      {['cdd','cdi'].includes(r.prestataire?.type_emploi ?? '') ? 'Salaire net (XOF) *' : 'Montant allocation (XOF) *'}
                    </label>
                    <input className="input" type="number" min={0} style={{ maxWidth: 200 }}
                      value={montantMap[r.id] ?? ''}
                      onChange={e => setMontantMap(m => ({ ...m, [r.id]: e.target.value }))} />
                  </div>
                )}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet)</label>
                  <textarea className="input" rows={2} value={commentMap[r.id] ?? ''}
                    onChange={e => setCommentMap(m => ({ ...m, [r.id]: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                    disabled={submitting === r.id}
                    onClick={() => agir(r.id, ['de', 'administrateur'].includes(role) ? 'autoriser' : 'valider')}>
                    {['de', 'administrateur'].includes(role) ? '✓ Autoriser' : '✓ Valider'}
                  </button>
                  <button className="btn danger" style={{ fontSize: 13 }}
                    disabled={submitting === r.id} onClick={() => agir(r.id, 'rejeter')}>
                    Rejeter
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
