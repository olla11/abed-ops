'use client'
import { useEffect, useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'

type Demande = {
  id: string; nom_complet: string; email_contact: string; departement: string
  objet: string; code_budgetaire: string; projet: string; nature_depense: string
  montant: number; mode_paiement: string; beneficiaire: string; reference_piece: string
  justification: string; urgence: string; date_souhaitee: string | null
  fichier_justificatif_url: string | null; status: string
  commentaire_aaf: string | null; commentaire_caf: string | null; commentaire_de: string | null
  created_at: string
  demandeur: { nom: string; prenoms: string } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:       { label: 'En attente AAF',    color: '#92660b' },
  valide_aaf:   { label: 'En attente CAF',    color: '#1e40af' },
  valide_caf:   { label: 'En attente DE',     color: '#6d28d9' },
  autorise:     { label: '✓ Autorisé',        color: '#166534' },
  rejete_aaf:   { label: '✗ Rejeté (AAF)',    color: '#991b1b' },
  rejete_caf:   { label: '✗ Rejeté (CAF)',    color: '#991b1b' },
  refuse_caf:   { label: '✗ Refusé (CAF)',    color: '#991b1b' },
  refuse_de:    { label: '✗ Refusé (DE)',     color: '#991b1b' },
}

const URGENCE_COLOR: Record<string, string> = {
  urgente: '#991b1b', normale: '#92660b', peut_attendre: '#1e40af',
}

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir : ' + (json.error ?? 'erreur'))
}

export default function TraitementDemandes({ role }: { role: string }) {
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pageATraiter, setPageATraiter] = useState(1)
  const [pageHistorique, setPageHistorique] = useState(1)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/demandes-paiement')
    const json = await res.json()
    setDemandes(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function agir(id: string, action: string) {
    const commentaire = commentMap[id] ?? ''
    if (action !== 'valider' && action !== 'autoriser' && !commentaire.trim()) {
      alert('Un commentaire est obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/demandes-paiement/${id}/traiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  function canAct(d: Demande) {
    if (role === 'aaf' || role === 'admin') return d.status === 'soumis'
    if (role === 'caf') return d.status === 'valide_aaf'
    if (role === 'de' || role === 'administrateur') return d.status === 'valide_caf'
    return false
  }

  const aTraiter = demandes.filter(canAct)
  const autres = demandes.filter(d => !canAct(d))

  if (loading) return <p>Chargement…</p>

  const renderDemande = (d: Demande, actif: boolean) => {
    const isOpen = expanded === d.id
    const st = STATUS_LABEL[d.status] ?? { label: d.status, color: '#374151' }
    return (
      <div key={d.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 8 }}
          onClick={() => setExpanded(isOpen ? null : d.id)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6,
                padding: '3px 10px', fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                👤 {d.nom_complet}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: URGENCE_COLOR[d.urgence] ?? '#374151',
                background: (URGENCE_COLOR[d.urgence] ?? '#374151') + '15', padding: '1px 6px', borderRadius: 999 }}>
                {d.urgence === 'urgente' ? '⚠️ Urgente' : d.urgence === 'peut_attendre' ? '🔵 Peut attendre' : '🔶 Normale'}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{d.objet}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
              <strong style={{ color: 'var(--abed-green)' }}>{Number(d.montant).toLocaleString('fr-FR')} FCFA</strong>
              {' '}— {d.departement} — {new Date(d.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
            <span style={{ fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {isOpen && (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Département', d.departement], ['Code budgétaire', d.code_budgetaire],
                ['Projet', d.projet], ['Nature', d.nature_depense],
                ['Mode paiement', d.mode_paiement], ['Bénéficiaire', d.beneficiaire],
                ['Réf. pièce', d.reference_piece],
                ['Date souhaitée', d.date_souhaitee ? new Date(d.date_souhaitee).toLocaleDateString('fr-FR') : '—'],
              ].map(([k, v]) => (
                <div key={k}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--abed-muted)' }}>{k}</span><br />
                  <span style={{ fontSize: 13 }}>{v}</span></div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Justification :</strong>
              <p style={{ fontSize: 13, marginTop: 4, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>{d.justification}</p>
            </div>
            {d.fichier_justificatif_url && (
              <button className="btn secondary" style={{ fontSize: 12, alignSelf: 'flex-start' }}
                onClick={() => openFile(d.fichier_justificatif_url!)}>
                📎 Voir pièce justificative
              </button>
            )}
            {(d.commentaire_aaf || d.commentaire_caf || d.commentaire_de) && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 10 }}>
                {d.commentaire_aaf && <p style={{ fontSize: 12 }}><strong>AAF :</strong> {d.commentaire_aaf}</p>}
                {d.commentaire_caf && <p style={{ fontSize: 12 }}><strong>CAF :</strong> {d.commentaire_caf}</p>}
                {d.commentaire_de && <p style={{ fontSize: 12 }}><strong>DE :</strong> {d.commentaire_de}</p>}
              </div>
            )}

            {actif && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet)</label>
                  <textarea className="input" rows={2} value={commentMap[d.id] ?? ''}
                    onChange={e => setCommentMap(m => ({ ...m, [d.id]: e.target.value }))}
                    placeholder="Motif de rejet ou observation…" />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(role === 'de' || role === 'administrateur') ? (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'autoriser')}>
                        ✓ Autoriser
                      </button>
                      <button className="btn danger" style={{ background: '#7f1d1d', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'refuser')}>
                        ✗ Refuser
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'valider')}>
                        ✓ Valider
                      </button>
                      <button className="btn danger" style={{ fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'rejeter')}>
                        ✗ Rejeter
                      </button>
                      {role === 'caf' && (
                        <button className="btn danger" style={{ background: '#7f1d1d', fontSize: 13 }}
                          disabled={submitting === d.id} onClick={() => agir(d.id, 'refuser')}>
                          ⛔ Refuser
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {aTraiter.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--abed-amber)' }}>
          <h3 style={{ marginBottom: 4 }}>⏳ À traiter ({aTraiter.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 12 }}>
            Demandes en attente de votre action.
          </p>
          {paginate(aTraiter, pageATraiter).map(d => renderDemande(d, true))}
          <Pagination page={pageATraiter} total={aTraiter.length} onChange={setPageATraiter} />
        </div>
      )}
      {autres.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Historique ({autres.length})</h3>
          {paginate(autres, pageHistorique).map(d => renderDemande(d, false))}
          <Pagination page={pageHistorique} total={autres.length} onChange={setPageHistorique} />
        </div>
      )}
      {demandes.length === 0 && (
        <div className="card">
          <p style={{ color: 'var(--abed-muted)' }}>Aucune demande de paiement.</p>
        </div>
      )}
    </div>
  )
}
