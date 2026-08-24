'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import DemandePaiementForm from './DemandePaiementForm'
import TraitementDemandes from './TraitementDemandes'
import Pagination, { paginate } from '@/components/Pagination'

// DP et administrateur (CA) n'ont aucune action sur ce circuit, mais gardent
// un droit de regard sur son évolution — via la Vue d'ensemble, en lecture seule.
const ROLES_TRANSPARENCE = ['dp', 'administrateur']

type Demande = {
  id: string; numero: string | null; nom_complet: string; objet: string; montant: number
  departement: string; status: string; created_at: string; urgence: string
  commentaire_aaf: string | null; commentaire_caf: string | null; commentaire_de: string | null
  demandeur_id: string
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

// Seul l'admin traite encore ce circuit depuis "Mon espace" (secours
// technique) : AAF, CAF et DE ont chacun leur propre menu dédié
// (/aaf/demandes-paiement, /caf/demandes-paiement, /de/demandes-paiement)
// pour tout ce qui concerne le traitement des dossiers d'autrui — "Mon
// espace" ne leur montre plus que leurs propres demandes, comme n'importe
// quel employé.
const isTraiteur = (r: string) => r === 'admin'

export default function DemandesClient({ role, userId, userEmail, userName }: {
  role: string; userId: string; userEmail: string; userName: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [mesDemandes, setMesDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  async function load() {
    const res = await fetch('/api/demandes-paiement')
    const json = await res.json()
    // L'API renvoie tout le circuit pour AAF/CAF (dont ils ont besoin sur
    // /aaf/demandes-paiement) — ici on ne garde que les demandes personnelles.
    if (!isTraiteur(role)) setMesDemandes((json.data ?? []).filter((d: Demande) => d.demandeur_id === userId))
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

      {/* Vue traitement pour DE/Admin (AAF/CAF : voir /aaf/demandes-paiement) */}
      {isTraiteur(role) && <TraitementDemandes role={role} userId={userId} />}

      {/* Mes demandes pour tous */}
      {!isTraiteur(role) && (
        <>
        {ROLES_TRANSPARENCE.includes(role) && (
          <Link href="/overview?type=demande&statut=tous" className="card" style={{
            display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
            borderLeft: '4px solid var(--abed-green)',
          }}>
            <span style={{ fontSize: 20 }}>👁</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Suivre toutes les demandes de paiement de l'organisation
              </div>
              <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>
                Vue transparence en lecture seule — voir leur évolution dans le circuit (AAF → CAF → DE)
              </div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 700 }}>Voir →</span>
          </Link>
        )}
        {loading ? <p>Chargement…</p> :
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
                      {d.numero && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace', display: 'block' }}>
                          {d.numero}
                        </span>
                      )}
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
        )}
        </>
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
