'use client'
import { useState, useEffect } from 'react'
import ExpressionBesoinForm from './ExpressionBesoinForm'
import TraitementExpressionsBesoin from './TraitementExpressionsBesoin'
import Pagination, { paginate } from '@/components/Pagination'

type Expression = {
  id: string; numero: string | null; projet_service: string; montant_total: number
  status: string; created_at: string; commentaire_aaf: string | null; commentaire_de: string | null
  demandeur_id: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:       { label: 'En attente AAF',  color: '#92660b' },
  valide_aaf:   { label: 'En attente DE',   color: '#6d28d9' },
  autorise:     { label: '✓ Autorisée',     color: '#166534' },
  rejete_aaf:   { label: '✗ Rejetée (AAF)', color: '#991b1b' },
  refuse_de:    { label: '✗ Refusée (DE)',  color: '#991b1b' },
}

// Seul l'admin traite encore ce circuit depuis "Mon espace" (secours
// technique) : AAF/CAF et DE ont chacun leur propre menu dédié.
const isTraiteur = (r: string) => r === 'admin'

export default function ExpressionsBesoinClient({ role, userId }: { role: string; userId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [mesExpressions, setMesExpressions] = useState<Expression[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  async function load() {
    const res = await fetch('/api/expressions-besoin')
    const json = await res.json()
    if (!isTraiteur(role)) setMesExpressions((json.data ?? []).filter((e: Expression) => e.demandeur_id === userId))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) return (
    <div className="card">
      <ExpressionBesoinForm onClose={() => { setShowForm(false); load() }} />
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Expressions de besoin</h1>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
            Soumettez une fiche d'expression de besoin pour un achat ou une prestation.
          </p>
        </div>
        <button className="btn" style={{ fontSize: 14, padding: '10px 20px' }} onClick={() => setShowForm(true)}>
          + Nouvelle fiche
        </button>
      </div>

      {isTraiteur(role) && <TraitementExpressionsBesoin role={role} userId={userId} />}

      {!isTraiteur(role) && (
        loading ? <p>Chargement…</p> :
        mesExpressions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--abed-muted)', marginBottom: 16 }}>
              Vous n'avez pas encore soumis d'expression de besoin.
            </p>
            <button className="btn" onClick={() => setShowForm(true)}>Faire ma première fiche</button>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Mes fiches ({mesExpressions.length})</h3>
            {paginate(mesExpressions, page).map(e => {
              const st = STATUS_LABEL[e.status] ?? { label: e.status, color: '#374151' }
              const comment = e.commentaire_aaf || e.commentaire_de
              return (
                <div key={e.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      {e.numero && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace', display: 'block' }}>
                          {e.numero}
                        </span>
                      )}
                      <strong>{e.projet_service}</strong>
                      <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                        <strong style={{ color: 'var(--abed-green)' }}>
                          {Number(e.montant_total).toLocaleString('fr-FR')} FCFA
                        </strong>
                        {' '}— {new Date(e.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      {comment && (
                        <p style={{ fontSize: 12, color: '#92660b', marginTop: 4, fontStyle: 'italic' }}>
                          Commentaire : {comment}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                      <a href={`/api/expressions-besoin/${e.id}/pdf`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--abed-green)', fontWeight: 600, textDecoration: 'none' }}>
                        📄 Voir la fiche PDF
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
            <Pagination page={page} total={mesExpressions.length} onChange={setPage} />
          </div>
        )
      )}

      {isTraiteur(role) && (
        <div style={{ marginTop: 4 }}>
          <button className="btn secondary" style={{ fontSize: 13 }} onClick={() => setShowForm(true)}>
            + Faire une demande personnelle
          </button>
        </div>
      )}
    </div>
  )
}
