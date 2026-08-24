'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { STATUT_LABELS, STATUT_COLORS, STATUTS_EN_PREPARATION, type OpportuniteStatut } from '@/lib/bd'

type Opportunite = { id: string; titre: string; bailleur: string | null; statut: OpportuniteStatut; date_limite: string }

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7 // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: { date: Date; inMonth: boolean }[] = []
  for (let i = startWeekday; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true })
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month, daysInMonth + (cells.length - startWeekday - daysInMonth + 1)), inMonth: false })
  return cells
}

export default function CalendrierClient({ opportunites }: { opportunites: Opportunite[] }) {
  const aujourdhui = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const [cursor, setCursor] = useState(() => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1))
  const [jourEtendu, setJourEtendu] = useState<string | null>(null)

  const parJour = useMemo(() => {
    const map = new Map<string, Opportunite[]>()
    for (const o of opportunites) {
      const key = o.date_limite.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return map
  }, [opportunites])

  const grid = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const enRetard = useMemo(() => {
    return opportunites
      .filter(o => STATUTS_EN_PREPARATION.includes(o.statut) && new Date(o.date_limite).setHours(0, 0, 0, 0) < aujourdhui.getTime())
      .sort((a, b) => a.date_limite.localeCompare(b.date_limite))
  }, [opportunites, aujourdhui])

  function changerMois(delta: number) {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    setJourEtendu(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', margin: '0 0 4px' }}>Calendrier</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>Opportunités classées par date limite.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => changerMois(-1)} aria-label="Mois précédent" style={navBtnStyle}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', minWidth: 150, textAlign: 'center' }}>
            {MOIS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>
          <button onClick={() => changerMois(1)} aria-label="Mois suivant" style={navBtnStyle}>
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => { setCursor(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)); setJourEtendu(null) }}
            style={{ ...navBtnStyle, width: 'auto', padding: '0 14px', fontSize: 12.5, fontWeight: 700 }}
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        {(Object.keys(STATUT_LABELS) as OpportuniteStatut[]).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUT_COLORS[s], display: 'inline-block' }} />
            {STATUT_LABELS[s]}
          </div>
        ))}
      </div>

      {enRetard.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} color="#991b1b" />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#991b1b' }}>
              En retard — délai dépassé sans soumission ({enRetard.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enRetard.map(o => {
              const jours = Math.round((aujourdhui.getTime() - new Date(o.date_limite).setHours(0, 0, 0, 0)) / 86400000)
              return (
                <Link key={o.id} href={`/bd/opportunites/${o.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #fecaca', textDecoration: 'none',
                }}>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUT_COLORS[o.statut], flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titre}</div>
                      <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{o.bailleur ?? 'Bailleur non précisé'} — {STATUT_LABELS[o.statut]}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, flexShrink: 0, padding: '3px 9px', borderRadius: 20,
                    color: '#991b1b', background: '#fee2e2',
                  }}>
                    Retard {jours}j
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid var(--abed-border)' }}>
          {JOURS.map(j => (
            <div key={j} style={{ padding: '10px 8px', fontSize: 11.5, fontWeight: 700, color: '#6b7280', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {j}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {grid.map(({ date, inMonth }, i) => {
            const key = toKey(date)
            const isToday = key === toKey(aujourdhui)
            const evenements = parJour.get(key) ?? []
            const etendu = jourEtendu === key
            const visibles = etendu ? evenements : evenements.slice(0, 3)
            const reste = evenements.length - visibles.length

            return (
              <div key={i} style={{
                minHeight: 108, padding: '6px 6px 8px', borderRight: (i + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none',
                borderBottom: '1px solid #f3f4f6', background: inMonth ? 'white' : '#fafafa',
              }}>
                <div style={{
                  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', fontSize: 12, fontWeight: isToday ? 800 : 500,
                  color: isToday ? 'white' : inMonth ? '#374151' : '#c1c5cb',
                  background: isToday ? 'var(--abed-green)' : 'transparent', marginBottom: 4,
                }}>
                  {date.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {visibles.map(o => (
                    <Link key={o.id} href={`/bd/opportunites/${o.id}`} title={o.titre} style={{
                      display: 'block', fontSize: 11, fontWeight: 600, color: STATUT_COLORS[o.statut],
                      background: STATUT_COLORS[o.statut] + '18', border: `1px solid ${STATUT_COLORS[o.statut]}40`,
                      borderRadius: 5, padding: '2px 6px', textDecoration: 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {o.titre}
                    </Link>
                  ))}
                  {reste > 0 && (
                    <button onClick={() => setJourEtendu(etendu ? null : key)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                      color: '#6b7280', textAlign: 'left', padding: '1px 6px',
                    }}>
                      +{reste} de plus
                    </button>
                  )}
                  {etendu && evenements.length > 3 && (
                    <button onClick={() => setJourEtendu(null)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, color: '#9ca3af', textAlign: 'left', padding: '1px 6px',
                    }}>
                      Réduire
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#374151',
}
