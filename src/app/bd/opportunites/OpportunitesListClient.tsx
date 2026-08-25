'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { STATUT_LABELS, DELAI_DEPASSE_LABEL, DELAI_DEPASSE_COLOR, estDelaiDepasse, statutAffiche, type OpportuniteStatut } from '@/lib/bd'

const PAR_PAGE = 20

type Opportunite = {
  id: string
  titre: string
  bailleur: string | null
  statut: OpportuniteStatut
  date_identification: string
  date_limite: string | null
  date_soumission: string | null
  identifie_par: { nom: string; prenoms: string } | null
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

export default function OpportunitesListClient({ opportunites }: { opportunites: Opportunite[] }) {
  const [filtre, setFiltre] = useState<OpportuniteStatut | 'tous' | 'delai_depasse'>('tous')
  const [annee, setAnnee] = useState<number | 'toutes'>(new Date().getFullYear())
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)

  const anneesDisponibles = Array.from(new Set([new Date().getFullYear(), ...opportunites.map(o => new Date(o.date_identification).getFullYear())])).sort((a, b) => b - a)

  const parAnnee = annee === 'toutes' ? opportunites : opportunites.filter(o => new Date(o.date_identification).getFullYear() === annee)
  const parStatut = filtre === 'tous' ? parAnnee
    : filtre === 'delai_depasse' ? parAnnee.filter(estDelaiDepasse)
    : parAnnee.filter(o => o.statut === filtre && !estDelaiDepasse(o))

  const terme = recherche.trim().toLowerCase()
  const filtered = !terme ? parStatut : parStatut.filter(o => {
    const identifiePar = o.identifie_par ? `${o.identifie_par.prenoms} ${o.identifie_par.nom}` : ''
    return o.titre.toLowerCase().includes(terme)
      || (o.bailleur ?? '').toLowerCase().includes(terme)
      || identifiePar.toLowerCase().includes(terme)
  })

  useEffect(() => { setPage(1) }, [filtre, annee, recherche])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAR_PAGE))
  const pageActuelle = Math.min(page, totalPages)
  const pagines = filtered.slice((pageActuelle - 1) * PAR_PAGE, pageActuelle * PAR_PAGE)

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher une opportunité (intitulé, bailleur, identifiée par...)"
          style={{
            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10, fontSize: 13.5,
            border: '1px solid #e5e7eb', boxSizing: 'border-box', background: 'white',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltre('tous')} style={filterBtnStyle(filtre === 'tous')}>
            Tous ({parAnnee.length})
          </button>
          {(Object.keys(STATUT_LABELS) as OpportuniteStatut[]).map(s => {
            const count = parAnnee.filter(o => o.statut === s && !estDelaiDepasse(o)).length
            if (count === 0) return null
            return (
              <button key={s} onClick={() => setFiltre(s)} style={filterBtnStyle(filtre === s)}>
                {STATUT_LABELS[s]} ({count})
              </button>
            )
          })}
          {(() => {
            const count = parAnnee.filter(estDelaiDepasse).length
            if (count === 0) return null
            return (
              <button
                onClick={() => setFiltre('delai_depasse')}
                style={filtre === 'delai_depasse' ? { ...filterBtnStyle(true), background: DELAI_DEPASSE_COLOR, borderColor: DELAI_DEPASSE_COLOR } : { ...filterBtnStyle(false), color: DELAI_DEPASSE_COLOR, borderColor: DELAI_DEPASSE_COLOR + '60' }}
              >
                {DELAI_DEPASSE_LABEL} ({count})
              </button>
            )
          })()}
        </div>
        {anneesDisponibles.length > 0 && (
          <select
            value={annee}
            onChange={e => setAnnee(e.target.value === 'toutes' ? 'toutes' : Number(e.target.value))}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, color: '#374151',
              border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer',
            }}
          >
            <option value="toutes">Toutes les années</option>
            {anneesDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card"><p style={{ color: 'var(--abed-muted)' }}>{terme ? 'Aucune opportunité ne correspond à cette recherche.' : 'Aucune opportunité.'}</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagines.map(o => {
            const badge = statutAffiche(o)
            return (
              <Link key={o.id} href={`/bd/opportunites/${o.id}`} className="card" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textDecoration: 'none', color: 'inherit', padding: '14px 18px', gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.titre}</div>
                  <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                    {o.bailleur ?? 'Bailleur non précisé'}
                    {o.identifie_par && ` — identifiée par ${o.identifie_par.prenoms} ${o.identifie_par.nom}`}
                    {o.date_limite && ` — échéance ${fmtDate(o.date_limite)}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: badge.color, background: badge.color + '15',
                  border: `1px solid ${badge.color}40`, borderRadius: 20, padding: '3px 12px', flexShrink: 0,
                }}>
                  {badge.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageActuelle === 1}
            style={pageBtnStyle(pageActuelle === 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6b7280' }}>
            Page {pageActuelle} sur {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageActuelle === totalPages}
            style={pageBtnStyle(pageActuelle === totalPages)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
  }
}

function filterBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--abed-green)' : 'white', color: active ? 'white' : '#374151',
    border: `1px solid ${active ? 'var(--abed-green)' : '#e5e7eb'}`,
  }
}
