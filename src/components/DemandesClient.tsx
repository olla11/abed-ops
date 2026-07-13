'use client'
import { useState, useEffect } from 'react'
import DemandePaiementForm from './DemandePaiementForm'
import TraitementDemandes from './TraitementDemandes'
import Pagination, { paginate } from '@/components/Pagination'

type Demande = {
  id: string; nom_complet: string; objet: string; montant: number
  departement: string; status: string; created_at: string; urgence: string
  commentaire_aaf: string | null; commentaire_caf: string | null; commentaire_de: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:       { label: 'En attente AAF',   color: '#92660b' },
  valide_aaf:   { label: 'En attente CAF',   color: '#1e40af' },
  valide_caf:   { label: 'En attente DE',    color: '#6d28d9' },
  autorise:     { label: '✓ Autorisé',       color: '#166534' },
  rejete_aaf:   { label: '✗ Rejeté (AAF)',   color: '#991b1b' },
  rejete_caf:   { label: '✗ Rejeté (CAF)',   color: '#991b1b' },
  refuse_caf:   { label: '✗ Refusé (CAF)',   color: '#991b1b' },
  refuse_de:    { label: '✗ Refusé (DE)',    color: '#991b1b' },
}

const isTraiteur = (r: string) => ['aaf', 'caf', 'de', 'dp', 'admin', 'administrateur'].includes(r)

export default function DemandesClient({ role, userEmail, userName }: {
  role: string; userEmail: string; userName: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [mesDemandes, setMesDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  async function load() {
    const res = await fetch('/api/demandes-paiement')
    const json = await res.json()
    if (!isTraiteur(role)) setMesDemandes(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (showForm) return (
    <div className="card">
      <DemandePaiementForm
        prefill={{ nom_complet: userName, email_contact: userEmail }}
        onClose={() => { setShowForm(false); load() }}
      />
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--abed-green)', marginBottom: 4 }}>Demandes de paiement</h1>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
            Soumettez et suivez vos demandes de paiement officielles.
          </p>
        </div>
        <button className="btn" style={{ fontSize: 14, padding: '10px 20px' }}
          onClick={() => setShowForm(true)}>
          + Nouvelle demande
        </button>
      </div>

      {/* Vue traitement pour AAF/CAF/DE/Admin */}
      {isTraiteur(role) && <TraitementDemandes role={role} />}

      {/* Mes demandes pour tous */}
      {!isTraiteur(role) && (
        loading ? <p>Chargement…</p> :
        mesDemandes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--abed-muted)', marginBottom: 16 }}>
              Vous n'avez pas encore soumis de demande de paiement.
            </p>
            <button className="btn" onClick={() => setShowForm(true)}>
              Faire ma première demande
            </button>
          </div>
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Mes demandes ({mesDemandes.length})</h3>
            {paginate(mesDemandes, page).map(d => {
              const st = STATUS_LABEL[d.status] ?? { label: d.status, color: '#374151' }
              const comment = d.commentaire_aaf || d.commentaire_caf || d.commentaire_de
              return (
                <div key={d.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <strong>{d.objet}</strong>
                      <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                        {d.departement} — <strong style={{ color: 'var(--abed-green)' }}>
                          {Number(d.montant).toLocaleString('fr-FR')} FCFA
                        </strong>
                        {' '}— {new Date(d.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      {comment && (
                        <p style={{ fontSize: 12, color: '#92660b', marginTop: 4, fontStyle: 'italic' }}>
                          Commentaire : {comment}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              )
            })}
            <Pagination page={page} total={mesDemandes.length} onChange={setPage} />
          </div>
        )
      )}

      {/* Traiteurs voient aussi leurs propres demandes en bas */}
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
