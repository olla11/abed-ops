'use client'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'
import { estRH } from '@/lib/roles'

type Conge = {
  id: string; statut: string; date_debut: string; date_fin: string; nb_jours: number | null
  motif: string | null; created_at: string; commentaire_valideur: string | null
  profile: { nom: string; prenoms: string; direction: string | null } | null
  type_conge: { nom: string } | null
}

type Solde = {
  profile_id: string; type_conge_id: string; jours_acquis: number; jours_pris: number; annee: number
  profile: { nom: string; prenoms: string; direction: string | null } | null
  type_conge: { nom: string } | null
}
type Personnel = { id: string; nom: string; prenoms: string; civilite: string | null }
type TypeConge = { id: string; nom: string; jours_annuels: number }

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente (responsable)', color: '#92400e', bg: '#fef3c7' },
  approuve_n1: { label: 'Approuvé N1 — attente RH/CAF', color: '#6d28d9', bg: '#ede9fe' },
  valide_rh: { label: 'Validé RH/CAF — attente DE', color: '#1e40af', bg: '#dbeafe' },
  approuve: { label: 'Autorisé (DE)', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Rejeté', color: '#991b1b', bg: '#fee2e2' },
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--abed-border)', outline: 'none',
}

export default function CongesRHClient({ conges: initial, soldes, personnel, typesConge, role }: { conges: Conge[]; soldes: Solde[]; personnel: Personnel[]; typesConge: TypeConge[]; role: string }) {
  // Secours admin/superadmin à chaque étape (y compris celle du responsable
  // technique, normalement traitée sur /conges par l'intéressé lui-même) —
  // RH/CAF ne valident que leur propre étape, plus celle du N1 à sa place.
  const estAdmin = ['admin', 'superadmin'].includes(role)
  const canValiderN1Secours = estAdmin
  const canValiderRH = estRH(role) || estAdmin
  const canValiderFinal = ['de', 'dp', 'administrateur'].includes(role) || estAdmin
  const [conges, setConges] = useState(initial)
  const [filterStatut, setFilterStatut] = useState('')
  const [page, setPage] = useState(1)
  const [vue, setVue] = useState<'demandes' | 'soldes'>('demandes')
  const [pageSoldes, setPageSoldes] = useState(1)
  const [filterSolde, setFilterSolde] = useState('')
  const [actionTarget, setActionTarget] = useState<Conge | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = conges.filter(c => !filterStatut || c.statut === filterStatut)

  async function valider(action: 'approuver' | 'rejeter') {
    if (!actionTarget) return
    setLoading(true)
    const res = await fetch(`/api/conges/${actionTarget.id}/valider`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire }),
    })
    setLoading(false)
    if (res.ok) {
      const d = await res.json()
      setConges(cs => cs.map(c => c.id === actionTarget.id ? { ...c, ...d.conge } : c))
      setActionTarget(null); setCommentaire('')
    }
  }

  const titreModal: Record<string, string> = {
    en_attente: 'Valider à la place du responsable technique (secours)',
    approuve_n1: 'Valider la demande (RH/CAF)',
    valide_rh: 'Autoriser la demande (DE)',
  }

  // Une ligne par employé (acquis selon le barème du type, pris selon
  // soldes_conges s'il existe une ligne — sinon 0) : donne la vue RH même
  // pour un employé qui n'a encore jamais posé tel type de congé. Congé
  // maternité réservé aux femmes, congé paternité exclusivement aux hommes
  // — pas de colonne pour le genre non concerné.
  const typesAvecBareme = typesConge.filter(t => t.jours_annuels > 0)
  const soldeParCle: Record<string, Solde> = {}
  soldes.forEach(s => { soldeParCle[`${s.profile_id}-${s.type_conge_id}`] = s })

  function infoPourType(profileId: string, type?: TypeConge) {
    if (!type) return null
    const existant = soldeParCle[`${profileId}-${type.id}`]
    const acquis = existant?.jours_acquis ?? type.jours_annuels
    const pris = existant?.jours_pris ?? 0
    return { acquis, pris, restant: acquis - pris }
  }

  const typeAnnuel = typesAvecBareme.find(t => t.nom === 'Congé annuel')
  const typeMaladie = typesAvecBareme.find(t => t.nom === 'Congé maladie')
  const typeMaternite = typesAvecBareme.find(t => t.nom === 'Congé maternité')
  const typePaternite = typesAvecBareme.find(t => t.nom === 'Congé paternité')

  const lignesSoldes = personnel
    .filter(p => !filterSolde || `${p.prenoms} ${p.nom}`.toLowerCase().includes(filterSolde.toLowerCase()))
    .sort((a, b) => `${a.prenoms}${a.nom}`.localeCompare(`${b.prenoms}${b.nom}`))
    .map(p => {
      // Civilité plutôt que le champ genre, moins fiablement renseigné —
      // 'Mme' = maternité, 'M.' = paternité, tout le reste (Dr, Pr, Mlle,
      // non renseigné) reste indéterminé plutôt que de deviner.
      const typeGenre = p.civilite === 'Mme' ? typeMaternite : p.civilite === 'M.' ? typePaternite : undefined
      return {
        profile: p,
        annuel: infoPourType(p.id, typeAnnuel),
        maladie: infoPourType(p.id, typeMaladie),
        genreLabel: p.civilite === 'Mme' ? 'Maternité' : p.civilite === 'M.' ? 'Paternité' : null,
        genreInfo: infoPourType(p.id, typeGenre),
      }
    })

  function CelluleSolde({ info }: { info: { acquis: number; pris: number; restant: number } | null }) {
    if (!info) return <span style={{ color: '#9ca3af' }}>—</span>
    return (
      <>
        <span style={{ fontWeight: 700, color: info.restant > 5 ? '#166534' : '#b45309' }}>{info.restant}j restants</span>
        <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>({info.pris}j pris / {info.acquis}j)</span>
      </>
    )
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: 0 }}>Congés</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setVue('demandes')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--abed-border)', background: vue === 'demandes' ? 'var(--abed-green)' : 'white', color: vue === 'demandes' ? 'white' : '#374151' }}>
            Demandes ({filtered.length})
          </button>
          <button onClick={() => setVue('soldes')} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--abed-border)', background: vue === 'soldes' ? 'var(--abed-green)' : 'white', color: vue === 'soldes' ? 'white' : '#374151' }}>
            Soldes de congés
          </button>
        </div>
      </div>

      {vue === 'demandes' && (
      <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employé', 'Type', 'Période', 'Jours', 'Motif', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginate(filtered, page).map((c, i) => {
              const s = STATUT[c.statut] ?? { label: c.statut, color: '#374151', bg: '#f3f4f6' }
              const canAct =
                (c.statut === 'en_attente' && canValiderN1Secours) ||
                (c.statut === 'approuve_n1' && canValiderRH) ||
                (c.statut === 'valide_rh' && canValiderFinal)
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.profile?.prenoms} {c.profile?.nom}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.type_conge?.nom ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.date_debut} → {c.date_fin}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700 }}>{c.nb_jours ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', maxWidth: 220, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', wordBreak: 'break-word' }}>{c.motif ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {canAct && (
                      <button onClick={() => { setActionTarget(c); setCommentaire('') }} style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 6, background: 'white', border: '1px solid var(--abed-border)', color: '#374151' }}>
                        Traiter
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun congé</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} total={filtered.length} onChange={p => { setPage(p) }} />
      </div>
      </>
      )}

      {vue === 'soldes' && (
      <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <input value={filterSolde} onChange={e => { setFilterSolde(e.target.value); setPageSoldes(1) }} placeholder="Rechercher un employé…" style={inputStyle} />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employé', 'Congé annuel', 'Congé maladie', 'Maternité / Paternité'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginate(lignesSoldes, pageSoldes).map((l, i) => (
              <tr key={l.profile.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{l.profile.prenoms} {l.profile.nom}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}><CelluleSolde info={l.annuel} /></td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}><CelluleSolde info={l.maladie} /></td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}>
                  {l.genreLabel && <span style={{ color: '#6b7280', marginRight: 6 }}>{l.genreLabel} :</span>}
                  <CelluleSolde info={l.genreInfo} />
                </td>
              </tr>
            ))}
            {lignesSoldes.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun employé</td></tr>
            )}
          </tbody>
        </table>
        <Pagination page={pageSoldes} total={lignesSoldes.length} onChange={p => setPageSoldes(p)} />
      </div>
      </>
      )}

      {actionTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 420 }}>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>
              {titreModal[actionTarget.statut] ?? 'Traiter la demande'}
            </h3>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
              <strong>{actionTarget.profile?.prenoms} {actionTarget.profile?.nom}</strong> — {actionTarget.type_conge?.nom ?? 'Congé'}
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              {actionTarget.date_debut} → {actionTarget.date_fin} ({actionTarget.nb_jours}j)
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Commentaire (facultatif)</label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: '1px solid var(--abed-border)', outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setActionTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}>Annuler</button>
              <button onClick={() => valider('rejeter')} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: '#dc2626', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
                Rejeter
              </button>
              <button onClick={() => valider('approuver')} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, opacity: loading ? .6 : 1 }}>
                Approuver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
