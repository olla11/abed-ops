'use client'
import { useEffect, useState } from 'react'
import { Clock, User, Users, CheckCircle2, type LucideIcon } from 'lucide-react'
import Pagination, { paginate } from '@/components/Pagination'
import { estAAF } from '@/lib/roles'

type Expression = {
  id: string; numero: string | null; demandeur_id: string; nom_demandeur: string; fonction: string | null; contact: string | null
  projet_service: string; nature_depense: string; code_budgetaire: string; ref_tdr: string | null
  lignes: { designation: string; quantite: string; montant_estime: number; reference: string }[]
  montant_total: number; status: string
  commentaire_aaf: string | null; commentaire_de: string | null
  created_at: string
  demandeur: { nom: string; prenoms: string } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:       { label: 'En attente AAF',  color: '#92660b' },
  valide_aaf:   { label: 'En attente DE',   color: '#6d28d9' },
  autorise:     { label: '✓ Autorisée',     color: '#166534' },
  rejete_aaf:   { label: '✗ Rejetée (AAF)', color: '#991b1b' },
  refuse_de:    { label: '✗ Refusée (DE)',  color: '#991b1b' },
}

const STATUTS_TERMINAUX = ['autorise', 'rejete_aaf', 'refuse_de']

type Onglet = { key: string; icon: LucideIcon; label: string; desc: string; count: number; color?: string; items: Expression[]; actif: boolean }
type Stage = 'aaf' | 'de'

export default function TraitementExpressionsBesoin({ role, userId, hideMesDemandes, stage }: { role: string; userId: string; hideMesDemandes?: boolean; stage?: Stage }) {
  const [expressions, setExpressions] = useState<Expression[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/expressions-besoin')
    const json = await res.json()
    setExpressions(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function agir(id: string, action: string) {
    const commentaire = commentMap[id] ?? ''
    if (action !== 'valider' && action !== 'autoriser' && !commentaire.trim()) {
      alert('Un commentaire est obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/expressions-besoin/${id}/traiter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  function canAct(e: Expression) {
    if (stage === 'aaf') return e.status === 'soumis' && (estAAF(role) || role === 'admin')
    if (stage === 'de') return e.status === 'valide_aaf' && (role === 'de' || role === 'admin')
    if (e.status === 'soumis') return estAAF(role) || role === 'admin'
    if (e.status === 'valide_aaf') return role === 'de' || role === 'admin'
    return false
  }

  const mesExpressions = expressions.filter(e => e.demandeur_id === userId)
  const autres = expressions.filter(e => e.demandeur_id !== userId)
  const aTraiter = autres.filter(canAct)
  const enCours = autres.filter(e => !canAct(e) && !STATUTS_TERMINAUX.includes(e.status))
  const cloturees = autres.filter(e => !canAct(e) && STATUTS_TERMINAUX.includes(e.status))

  const onglets: Onglet[] = [
    { key: 'a_traiter', icon: Clock, label: 'À traiter', desc: 'Votre action requise',
      count: aTraiter.length, color: aTraiter.length > 0 ? '#b45309' : undefined, items: aTraiter, actif: true },
    ...(hideMesDemandes ? [] : [
      { key: 'mes_demandes', icon: User, label: 'Mes fiches', desc: 'Vos soumissions personnelles',
        count: mesExpressions.length, color: mesExpressions.length > 0 ? '#166534' : undefined, items: mesExpressions, actif: false },
    ]),
    { key: 'en_cours', icon: Users, label: 'En cours ailleurs', desc: "Chez d'autres traiteurs",
      count: enCours.length, color: enCours.length > 0 ? '#1e40af' : undefined, items: enCours, actif: false },
    { key: 'cloturees', icon: CheckCircle2, label: 'Clôturées', desc: 'Statut définitif',
      count: cloturees.length, color: cloturees.length > 0 ? '#6b7280' : undefined, items: cloturees, actif: false },
  ]

  if (loading) return <p>Chargement…</p>

  if (expressions.length === 0) {
    return <div className="card"><p style={{ color: 'var(--abed-muted)' }}>Aucune expression de besoin.</p></div>
  }

  const currentKey = activeTab ?? (aTraiter.length > 0 ? 'a_traiter' : onglets.find(o => o.count > 0)?.key ?? 'a_traiter')
  const current = onglets.find(o => o.key === currentKey) ?? onglets[0]

  const renderExpression = (e: Expression, actif: boolean) => {
    const isOpen = expanded === e.id
    const st = STATUS_LABEL[e.status] ?? { label: e.status, color: '#374151' }
    return (
      <div key={e.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 8 }}
          onClick={() => setExpanded(isOpen ? null : e.id)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              {e.numero && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace' }}>{e.numero}</span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6,
                padding: '3px 10px', fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                👤 {e.nom_demandeur}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{e.projet_service}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
              <strong style={{ color: 'var(--abed-green)' }}>{Number(e.montant_total).toLocaleString('fr-FR')} FCFA</strong>
              {' '}— {e.nature_depense} — {new Date(e.created_at).toLocaleDateString('fr-FR')}
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
                ['Fonction', e.fonction ?? '—'], ['Contact', e.contact ?? '—'],
                ['Code budgétaire', e.code_budgetaire], ['Réf. TDR', e.ref_tdr ?? '—'],
              ].map(([k, v]) => (
                <div key={k}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--abed-muted)' }}>{k}</span><br />
                  <span style={{ fontSize: 13 }}>{v}</span></div>
              ))}
            </div>
            <div className="table-wrap">
              <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0fdf4' }}>
                    {['Désignation', 'Quantité', 'Montant estimé', 'Référence'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #d1d5db' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(e.lignes ?? []).map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>{l.designation}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>{l.quantite}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>{Number(l.montant_estime).toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>{l.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a href={`/api/expressions-besoin/${e.id}/pdf`} target="_blank" rel="noreferrer"
              className="btn secondary" style={{ fontSize: 12, alignSelf: 'flex-start' }}>
              📄 Voir la fiche PDF
            </a>
            {(e.commentaire_aaf || e.commentaire_de) && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 10 }}>
                {e.commentaire_aaf && <p style={{ fontSize: 12 }}><strong>AAF :</strong> {e.commentaire_aaf}</p>}
                {e.commentaire_de && <p style={{ fontSize: 12 }}><strong>DE :</strong> {e.commentaire_de}</p>}
              </div>
            )}

            {actif && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet)</label>
                  <textarea className="input" rows={2} value={commentMap[e.id] ?? ''}
                    onChange={ev => setCommentMap(m => ({ ...m, [e.id]: ev.target.value }))}
                    placeholder="Motif de rejet ou observation…" />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {e.status === 'valide_aaf' ? (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === e.id} onClick={() => agir(e.id, 'autoriser')}>
                        ✓ Autoriser
                      </button>
                      <button className="btn danger" style={{ fontSize: 13 }}
                        disabled={submitting === e.id} onClick={() => agir(e.id, 'refuser')}>
                        ✗ Refuser
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === e.id} onClick={() => agir(e.id, 'valider')}>
                        ✓ Valider
                      </button>
                      <button className="btn danger" style={{ fontSize: 13 }}
                        disabled={submitting === e.id} onClick={() => agir(e.id, 'rejeter')}>
                        ✗ Rejeter
                      </button>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {onglets.map(o => {
          const active = currentKey === o.key
          return (
            <button key={o.key} onClick={() => { setActiveTab(o.key); setPage(1) }}
              style={{
                background: active ? 'var(--abed-green)' : 'white',
                border: active ? '2px solid var(--abed-green)' : '2px solid #e5e7eb',
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                boxShadow: active ? '0 4px 14px rgba(6,95,70,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <o.icon size={22} color={active ? 'white' : (o.color ?? '#6b7280')} strokeWidth={1.75} />
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : (o.count > 0 ? '#fef3c7' : '#f3f4f6'),
                  color: active ? 'white' : (o.count > 0 ? '#92400e' : '#9ca3af'),
                  borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700,
                  border: active ? '1px solid rgba(255,255,255,0.3)' : (o.count > 0 ? '1px solid #fcd34d' : '1px solid #e5e7eb'),
                }}>{o.count}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'white' : '#111827', marginBottom: 2 }}>{o.label}</div>
              <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}>{o.desc}</div>
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <current.icon size={16} color="var(--abed-green)" strokeWidth={2} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{current.label}</span>
          {current.count > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700, border: '1px solid #fcd34d' }}>
              {current.count}
            </span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {current.items.length === 0 ? (
            <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucune fiche dans cette catégorie.</p>
          ) : (
            <>
              {paginate(current.items, page).map(e => renderExpression(e, current.actif))}
              <Pagination page={page} total={current.items.length} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
