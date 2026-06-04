'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const MODE_LABELS: Record<string, string> = {
  credit: 'À crédit',
  avance: 'Sur avance',
  totalite_avant: 'Totalité avant départ',
}

export default function ReconciliationValidationCAF({
  missionId,
  mission,
}: {
  missionId: string
  mission: {
    mode_financement: string | null
    point_financier: any
    rapport: any
    total_depenses: number | null
    reconciliation_commentaire: string | null
  }
}) {
  const router = useRouter()
  const [commentaire, setCommentaire] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')
  const [loading, setLoading] = useState<'valider' | 'rejeter' | null>(null)

  const pf: any[] = Array.isArray(mission.point_financier) ? mission.point_financier : []
  const rapport = mission.rapport as any ?? {}

  async function handle(action: 'valider' | 'rejeter') {
    if (action === 'rejeter' && !commentaire.trim()) {
      setMsg('Saisissez un commentaire pour le rejet.'); setMsgType('err'); return
    }
    setLoading(action); setMsg('')
    const res = await fetch(`/api/missions/${missionId}/valider-reconciliation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire }),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) {
      setMsg('Erreur : ' + (data.error ?? 'inconnue')); setMsgType('err'); return
    }
    setMsg(action === 'valider' ? 'Réconciliation validée. Mission clôturée.' : 'Réconciliation rejetée.')
    setMsgType('ok')
    setTimeout(() => router.refresh(), 1200)
  }

  return (
    <div className="card" style={{ border: '2px solid var(--abed-amber)', marginTop: 20 }}>
      <h3 style={{ marginBottom: 4, fontSize: 15, color: '#92400e' }}>
        Validation CAF — Réconciliation en attente
      </h3>
      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Mode financement : <strong>{MODE_LABELS[mission.mode_financement ?? ''] ?? '—'}</strong>
      </p>

      {/* Rapport */}
      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Rapport de mission</h4>
      <table style={{ marginBottom: 16, fontSize: 13 }}>
        <tbody>
          {[
            ['Objectifs', rapport.objectifs],
            ['Activités', rapport.activites],
            ['Résultats', rapport.resultats],
            ['Difficultés', rapport.difficultes],
            ['Suite', rapport.suite],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={{ fontWeight: 600, width: 120, paddingRight: 12, verticalAlign: 'top', paddingBottom: 6 }}>{k}</td>
              <td style={{ paddingBottom: 6 }}>{v || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Point financier */}
      <h4 style={{ fontSize: 13, marginBottom: 8 }}>Point financier</h4>
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table style={{ fontSize: 13 }}>
          <thead><tr><th>Libellé</th><th>Qté</th><th>P.U. (F)</th><th>Montant</th></tr></thead>
          <tbody>
            {pf.map((l: any, i: number) => (
              <tr key={i}>
                <td>{l.libelle}</td>
                <td>{l.quantite}</td>
                <td>{Number(l.pu).toLocaleString('fr-FR')}</td>
                <td style={{ fontWeight: 600 }}>{Number(l.montant).toLocaleString('fr-FR')} F</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right', marginBottom: 16 }}>
        Total dépenses : {Number(mission.total_depenses ?? 0).toLocaleString('fr-FR')} F CFA
      </div>

      {/* Actions */}
      <div className="field">
        <label className="label">Commentaire (obligatoire pour le rejet)</label>
        <textarea className="textarea" rows={3} value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          placeholder="Motif de rejet ou observations…" />
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
          background: msgType === 'ok' ? '#dcfce7' : '#fee2e2',
          color: msgType === 'ok' ? '#166534' : '#991b1b',
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn" onClick={() => handle('valider')} disabled={!!loading}>
          {loading === 'valider' ? '⏳…' : '✓ Valider & clôturer'}
        </button>
        <button className="btn danger" onClick={() => handle('rejeter')} disabled={!!loading}>
          {loading === 'rejeter' ? '⏳…' : 'Rejeter'}
        </button>
      </div>
    </div>
  )
}
