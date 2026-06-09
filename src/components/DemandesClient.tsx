'use client'
import { useState, useEffect } from 'react'
import TabBar from './TabBar'
import DemandePaiementForm from './DemandePaiementForm'
import TraitementDemandes from './TraitementDemandes'
import Paginator from './Paginator'

const PER_PAGE = 10

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

const PENDING_STATUSES = ['soumis', 'valide_aaf', 'valide_caf']

function isTraiteur(r: string) {
  return ['aaf', 'caf', 'de', 'admin', 'administrateur'].includes(r)
}

export default function DemandesClient({ role, userEmail, userName }: {
  role: string; userEmail: string; userName: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [mesDemandes, setMesDemandes] = useState<Demande[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'mes' | 'traiter'>('mes')
  const [page, setPage] = useState(1)

  const traiteur = isTraiteur(role)
  const pagedDemandes = mesDemandes.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  async function load() {
    // Pour les traiteurs, on récupère uniquement leurs propres demandes pour l'onglet "Mes demandes"
    const url = traiteur ? '/api/demandes-paiement?mine=true' : '/api/demandes-paiement'
    const res = await fetch(url)
    const json = await res.json()
    setMesDemandes(json.data ?? [])

    if (traiteur) {
      // Récupérer toutes les demandes pour compter les actionnables
      const resAll = await fetch('/api/demandes-paiement')
      const jsonAll = await resAll.json()
      const all: Demande[] = jsonAll.data ?? []
      const pending = all.filter(d => {
        if (role === 'aaf' || role === 'admin') return d.status === 'soumis'
        if (role === 'caf') return d.status === 'valide_aaf'
        if (role === 'de' || role === 'administrateur') return d.status === 'valide_caf'
        return false
      })
      setPendingCount(pending.length)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Quand on ouvre le formulaire, revenir sur "Mes demandes" à la fermeture
  if (showForm) return (
    <div className="card">
      <DemandePaiementForm
        prefill={{ nom_complet: userName, email_contact: userEmail }}
        onClose={() => { setShowForm(false); load() }}
      />
    </div>
  )

  const tabs = traiteur
    ? [
        { key: 'mes', label: 'Mes demandes' },
        { key: 'traiter', label: 'À traiter', count: pendingCount },
      ]
    : []

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* En-tête */}
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

      <div className="card">
        {traiteur && tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            active={activeTab}
            onChange={k => setActiveTab(k as 'mes' | 'traiter')}
          />
        )}

        {/* ── Mes demandes ── */}
        {(!traiteur || activeTab === 'mes') && (
          loading ? <p>Chargement…</p> :
          mesDemandes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--abed-muted)', marginBottom: 16 }}>
                Vous n'avez pas encore soumis de demande de paiement.
              </p>
              <button className="btn" onClick={() => setShowForm(true)}>
                Faire ma première demande
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>
                Mes demandes ({mesDemandes.length})
              </h3>
              {pagedDemandes.map(d => {
                const st = STATUS_LABEL[d.status] ?? { label: d.status, color: '#374151' }
                const comment = d.commentaire_aaf || d.commentaire_caf || d.commentaire_de
                const isPending = PENDING_STATUSES.includes(d.status)
                return (
                  <div key={d.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{d.objet}</strong>
                        <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                          {d.departement} — <strong style={{ color: 'var(--abed-green)' }}>
                            {Number(d.montant).toLocaleString('fr-FR')} XOF
                          </strong>
                          {' '}— {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        </div>
                        {comment && (
                          <p style={{ fontSize: 12, color: '#92660b', marginTop: 4, fontStyle: 'italic' }}>
                            Commentaire : {comment}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                          background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>
                          {st.label}
                        </span>
                        {isPending && (
                          <span style={{ fontSize: 10, color: 'var(--abed-muted)' }}>En cours de traitement</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <Paginator page={page} total={mesDemandes.length} perPage={PER_PAGE} onChange={setPage} />
            </>
          )
        )}

        {/* ── À traiter (traiteurs seulement) ── */}
        {traiteur && activeTab === 'traiter' && (
          <TraitementDemandes role={role} />
        )}
      </div>
    </div>
  )
}
