'use client'
import { useMemo, useState } from 'react'
import { FileText, CheckCircle2, Clock, XCircle, Eye } from 'lucide-react'
import Pagination, { paginate } from '@/components/Pagination'

type Signataire = {
  id: string
  profile_id: string | null
  email: string | null
  nom_externe: string | null
  signe: boolean
  signe_le: string | null
  refuse: boolean
  refuse_le: string | null
  refuse_motif: string | null
  ordre: number | null
  est_observateur: boolean
  profile: { nom: string; prenoms: string } | null
}

type Demande = {
  id: string
  titre: string
  description: string | null
  statut: string
  type: string | null
  created_at: string
  updated_at: string | null
  createur_id: string
  createur: { nom: string; prenoms: string } | null
  signataires: Signataire[]
}

const STATUT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#b45309', bg: '#fef3c7' },
  complete: { label: 'Signée ✓', color: '#166534', bg: '#dcfce7' },
  refusee: { label: 'Refusée', color: '#b91c1c', bg: '#fee2e2' },
}

function nomSignataire(s: Signataire) {
  if (s.profile) return `${s.profile.prenoms} ${s.profile.nom}`.trim()
  if (s.nom_externe) return s.nom_externe
  return s.email ?? 'Signataire'
}

function fmtDateHeure(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SignaturesJournalClient({ demandes }: { demandes: Demande[] }) {
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Demande | null>(null)

  const filtered = useMemo(() => demandes.filter(d => {
    const q = search.toLowerCase()
    const nomCreateur = d.createur ? `${d.createur.prenoms} ${d.createur.nom}` : ''
    const nomsSignataires = d.signataires.map(nomSignataire).join(' ')
    const matchSearch = !q || d.titre.toLowerCase().includes(q) || nomCreateur.toLowerCase().includes(q) || nomsSignataires.toLowerCase().includes(q)
    const matchStatut = !filterStatut || d.statut === filterStatut
    return matchSearch && matchStatut
  }), [demandes, search, filterStatut])

  return (
    <div className="page-container">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 20, margin: '0 0 4px' }}>Historique des demandes de signature ({filtered.length})</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Toute demande de signature créée sur la plateforme, avec son demandeur, sa date, et la date/heure de
          signature de chaque signataire — y compris une fois entièrement signée (elle ne disparaît pas d'ici,
          contrairement à la page « Signatures »).
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Rechercher un titre, un demandeur, un signataire..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 240, padding: '8px 12px', borderRadius: 8, fontSize: 14, border: '1px solid var(--abed-border)' }}
        />
        <select
          value={filterStatut}
          onChange={e => { setFilterStatut(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: 8, fontSize: 14, border: '1px solid var(--abed-border)', maxWidth: 200 }}
        >
          <option value="">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="complete">Signée</option>
          <option value="refusee">Refusée</option>
        </select>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Titre', 'Demandeur', 'Date de la demande', 'Statut', 'Signataires', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginate(filtered, page).map((d, i) => {
                const badge = STATUT_BADGE[d.statut] ?? { label: d.statut, color: '#374151', bg: '#f3f4f6' }
                const signataires = d.signataires.filter(s => !s.est_observateur)
                const nbSignes = signataires.filter(s => s.signe).length
                return (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titre}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{d.createur ? `${d.createur.prenoms} ${d.createur.nom}` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateHeure(d.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{nbSignes}/{signataires.length} signé{nbSignes > 1 ? 's' : ''}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => setSelected(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#374151' }}>
                        <Eye size={13} /> Détail
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 12px', textAlign: 'center', fontSize: 13, color: 'var(--abed-muted)' }}>Aucune demande de signature trouvée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={filtered.length} onChange={setPage} />

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <FileText size={18} color="var(--abed-green)" style={{ flexShrink: 0, marginTop: 2 }} />
              <h3 style={{ margin: 0, fontSize: 16 }}>{selected.titre}</h3>
            </div>
            {selected.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>{selected.description}</p>}

            <div style={{ fontSize: 13, color: '#374151', marginBottom: 18, background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
              <strong>Demandeur :</strong> {selected.createur ? `${selected.createur.prenoms} ${selected.createur.nom}` : '—'}
              <br /><strong>Date de la demande :</strong> {fmtDateHeure(selected.created_at)}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>Signataires</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.signataires.map(s => {
                const Icon = s.refuse ? XCircle : s.signe ? CheckCircle2 : Clock
                const color = s.refuse ? '#dc2626' : s.signe ? '#16a34a' : '#b45309'
                const statutTexte = s.refuse
                  ? `Refusé le ${fmtDateHeure(s.refuse_le)}${s.refuse_motif ? ` — ${s.refuse_motif}` : ''}`
                  : s.signe ? `Signé le ${fmtDateHeure(s.signe_le)}` : 'En attente de signature'
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                        {nomSignataire(s)}{s.est_observateur && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}> (observateur)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{statutTexte}</div>
                    </div>
                  </div>
                )
              })}
              {selected.signataires.length === 0 && <p style={{ fontSize: 13, color: 'var(--abed-muted)' }}>Aucun signataire enregistré.</p>}
            </div>

            <button onClick={() => setSelected(null)} style={{ marginTop: 20, width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
