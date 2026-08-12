'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Pagination, { paginate } from '@/components/Pagination'
import PiecesJointesList from '@/components/PiecesJointesList'

type Soumission = {
  id: string; titre: string; status: string
  periode_mois: number; periode_annee: number
  heures_retenues: number; montant_caf: number | null; paye: boolean
  fichier_facture_url: string | null; fichier_timesheet_url: string | null; fichier_livrable_url: string | null
  commentaire_de: string | null
  prestataire_id: string
  prestataire: { prenoms: string; nom: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  autorise_de: '✓ Autorisé par vous', refuse_de: '✗ Refusé par vous',
}

export default function ValidationTimesheetsDE({ userId }: { userId: string }) {
  const supabase = createClient()
  const [items, setItems] = useState<Soumission[]>([])
  const [historique, setHistorique] = useState<Soumission[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedHist, setExpandedHist] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  async function load() {
    const [{ data }, { data: hist }] = await Promise.all([
      supabase
        .from('soumissions')
        .select('id,titre,status,periode_mois,periode_annee,heures_retenues,montant_caf,paye,fichier_facture_url,fichier_timesheet_url,fichier_livrable_url,commentaire_de,prestataire_id,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
        .eq('status', 'valide_caf')
        .order('created_at', { ascending: false }),
      // Déjà traités par vous — reste consultable.
      supabase
        .from('soumissions')
        .select('id,titre,status,periode_mois,periode_annee,heures_retenues,montant_caf,paye,fichier_facture_url,fichier_timesheet_url,fichier_livrable_url,commentaire_de,prestataire_id,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
        .or('status.eq.autorise_de,status.eq.refuse_de')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setItems((data as any) ?? [])
    setHistorique((hist as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function agir(id: string, action: 'autoriser' | 'rejeter') {
    if (action === 'rejeter' && !commentMap[id]?.trim()) {
      alert('Un commentaire est obligatoire pour refuser.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/timesheets/${id}/valider-de`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire_de: commentMap[id] }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  // Personne ne s'auto-autorise, même si son propre timesheet en est au bon stade.
  const aTraiter = items.filter(s => s.prestataire_id !== userId)

  if (loading) return <p>Chargement…</p>
  if (aTraiter.length === 0 && historique.length === 0) {
    return <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun timesheet à autoriser.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Timesheets à autoriser ({aTraiter.length})</h3>
        <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
          Validés financièrement par la CAF — autorisez pour permettre le paiement, ou refusez.
        </p>
        {aTraiter.length === 0 && (
          <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun dossier en attente.</p>
        )}
        {paginate(aTraiter, page).map(s => {
          const isOpen = expanded === s.id
          return (
            <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div>
                  <strong>{s.titre}</strong>
                  <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                    {s.prestataire?.prenoms} {s.prestataire?.nom}
                    {' '}— {s.periode_mois}/{s.periode_annee}
                    {' '}— <strong>{s.heures_retenues} h</strong>
                    {' '}→ <strong style={{ color: 'var(--abed-green)' }}>{(s.montant_caf ?? 0).toLocaleString('fr-FR')} FCFA</strong>
                  </span>
                </div>
                <span style={{ fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {s.fichier_facture_url && (
                      <PiecesJointesList pieces={[{ path: s.fichier_facture_url, nom: 'Facture' }]} />
                    )}
                    {s.fichier_timesheet_url && (
                      <PiecesJointesList pieces={[{ path: s.fichier_timesheet_url, nom: 'Timesheet Excel' }]} />
                    )}
                    {s.fichier_livrable_url && (
                      <PiecesJointesList pieces={[{ path: s.fichier_livrable_url, nom: 'Livrable' }]} />
                    )}
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Commentaire (obligatoire si refus)</label>
                    <textarea className="input" rows={2} value={commentMap[s.id] ?? ''}
                      placeholder="Motif si vous refusez…"
                      onChange={e => setCommentMap(m => ({ ...m, [s.id]: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => agir(s.id, 'autoriser')}>
                      ✓ Autoriser
                    </button>
                    <button className="btn danger" style={{ fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => agir(s.id, 'rejeter')}>
                      Refuser
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <Pagination page={page} total={aTraiter.length} onChange={setPage} />
      </div>

      {historique.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #9ca3af' }}>
          <h3 style={{ marginBottom: 4 }}>🗂 Historique ({historique.length})</h3>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
            Dossiers déjà traités par vous — montant et documents restent consultables ici.
          </p>
          {historique.map(s => {
            const isOpen = expandedHist === s.id
            return (
              <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedHist(isOpen ? null : s.id)}>
                  <div>
                    <strong>{s.titre}</strong>
                    <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                      {s.prestataire?.prenoms} {s.prestataire?.nom} — {s.periode_mois}/{s.periode_annee}
                      {s.montant_caf != null && (
                        <strong style={{ color: 'var(--abed-green)', marginLeft: 8 }}>
                          {s.montant_caf.toLocaleString('fr-FR')} FCFA
                        </strong>
                      )}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    {s.commentaire_de && (
                      <p style={{ fontSize: 12, fontStyle: 'italic', color: '#374151' }}>
                        Votre commentaire : {s.commentaire_de}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {s.fichier_facture_url && (
                        <PiecesJointesList pieces={[{ path: s.fichier_facture_url, nom: 'Facture' }]} />
                      )}
                      {s.fichier_timesheet_url && (
                        <PiecesJointesList pieces={[{ path: s.fichier_timesheet_url, nom: 'Timesheet Excel' }]} />
                      )}
                      {s.fichier_livrable_url && (
                        <PiecesJointesList pieces={[{ path: s.fichier_livrable_url, nom: 'Livrable' }]} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
