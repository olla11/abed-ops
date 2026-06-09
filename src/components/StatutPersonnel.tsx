'use client'
import { useEffect, useState } from 'react'

type Item = {
  id: string
  type: 'timesheet' | 'rapport' | 'om' | 'demande'
  reference: string
  periode: string
  montant: number | null
  status: string
  urgence?: string
  created_at: string
}

const TYPE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  timesheet: { label: 'Timesheet',        color: '#1e40af', bg: '#eff6ff' },
  rapport:   { label: 'Rapport mensuel',  color: '#6d28d9', bg: '#f5f3ff' },
  om:        { label: 'Ordre de mission', color: '#0f766e', bg: '#f0fdfa' },
  demande:   { label: 'Demande paiement', color: '#92660b', bg: '#fffbeb' },
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  soumis:          { label: 'Soumis — en attente',      color: '#92660b', icon: '⏳' },
  valide_tech:     { label: 'Validé par le manager',    color: '#1e40af', icon: '✓' },
  traite_aaf:      { label: 'Traité par AAF',           color: '#6d28d9', icon: '✓' },
  valide_aaf:      { label: 'Validé par AAF',           color: '#6d28d9', icon: '✓' },
  valide_caf:      { label: 'Validé par CAF',           color: '#0f766e', icon: '✓' },
  autorise:        { label: 'Autorisé ✓',               color: '#166534', icon: '✅' },
  signe:           { label: 'Signé',                    color: '#166534', icon: '✅' },
  cloture:         { label: 'Clôturé',                  color: '#374151', icon: '✅' },
  brouillon:       { label: 'Brouillon',                color: '#6b7280', icon: '📝' },
  annule:          { label: 'Annulé',                   color: '#6b7280', icon: '—' },
  corrections_tech:{ label: 'Corrections demandées',    color: '#9a3412', icon: '⚠' },
  corrections_caf: { label: 'Corrections CAF',          color: '#9a3412', icon: '⚠' },
  rejete_tech:     { label: 'Rejeté par le manager',    color: '#991b1b', icon: '✗' },
  rejete_caf:      { label: 'Rejeté par la CAF',        color: '#991b1b', icon: '✗' },
  rejete_aaf:      { label: 'Rejeté par AAF',           color: '#991b1b', icon: '✗' },
  rejete_manager:  { label: 'Rejeté par le manager',    color: '#991b1b', icon: '✗' },
  refuse_caf:      { label: 'Refusé par la CAF',        color: '#991b1b', icon: '✗' },
  refuse_de:       { label: 'Refusé par le DE',         color: '#991b1b', icon: '✗' },
}

// Étapes du circuit selon le type
const CIRCUIT: Record<string, string[]> = {
  timesheet: ['soumis', 'valide_tech', 'valide_caf'],
  rapport:   ['soumis', 'valide_tech', 'traite_aaf', 'valide_caf', 'autorise'],
  om:        ['soumis', 'signe', 'cloture'],
  demande:   ['soumis', 'valide_aaf', 'valide_caf', 'autorise'],
}

const FINAL_NEGATIVE = ['rejete_tech','rejete_caf','rejete_aaf','rejete_manager','refuse_caf','refuse_de','annule','corrections_tech','corrections_caf']
const FINAL_POSITIVE = ['autorise','signe','cloture','valide_caf']

function ProgressBar({ type, status }: { type: string; status: string }) {
  const steps = CIRCUIT[type] ?? []
  const isNeg = FINAL_NEGATIVE.includes(status)
  const currentIdx = steps.indexOf(status)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
      {steps.map((step, i) => {
        const done = currentIdx >= i && !isNeg
        const current = currentIdx === i && !isNeg
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: done ? 'var(--abed-green)' : '#e5e7eb',
              border: current ? '2px solid var(--abed-green)' : '2px solid transparent',
              flexShrink: 0,
            }} />
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 2, background: done ? 'var(--abed-green)' : '#e5e7eb' }} />
            )}
          </div>
        )
      })}
      {isNeg && <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600, marginLeft: 4 }}>Dossier retourné</span>}
    </div>
  )
}

export default function StatutPersonnel() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('tous')

  useEffect(() => {
    fetch('/api/statut').then(r => r.json()).then(j => {
      setItems(j.data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = filterType === 'tous' ? items : items.filter(i => i.type === filterType)
  const enCours = items.filter(i => !FINAL_POSITIVE.includes(i.status) && !FINAL_NEGATIVE.includes(i.status) && i.status !== 'annule').length

  if (loading) return <div className="card"><p style={{ fontSize: 14, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* Résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {[
          { label: 'En cours',   value: enCours,                                    color: '#374151' },
          { label: 'Timesheets', value: items.filter(i => i.type === 'timesheet').length, color: '#1e40af' },
          { label: 'Rapports',   value: items.filter(i => i.type === 'rapport').length,   color: '#6d28d9' },
          { label: 'OM',         value: items.filter(i => i.type === 'om').length,        color: '#0f766e' },
          { label: 'Demandes',   value: items.filter(i => i.type === 'demande').length,   color: '#92660b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: `2px solid ${s.color}22`,
            borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtre type */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['tous','Tout'],['timesheet','Timesheets'],['rapport','Rapports'],['om','OM'],['demande','Demandes']].map(([v, l]) => (
          <button key={v} onClick={() => setFilterType(v)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: filterType === v ? 700 : 400,
              background: filterType === v ? 'var(--abed-green)' : 'white',
              color: filterType === v ? 'white' : '#374151',
              border: '1px solid var(--abed-border)', borderRadius: 6, cursor: 'pointer',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 14, color: 'var(--abed-muted)', textAlign: 'center' }}>Aucune soumission.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(item => {
            const ti = TYPE_INFO[item.type]
            const sm = STATUS_META[item.status] ?? { label: item.status, color: '#374151', icon: '•' }
            const isNeg = FINAL_NEGATIVE.includes(item.status)
            const isPos = FINAL_POSITIVE.includes(item.status)
            return (
              <div key={item.id} className="card" style={{
                borderLeft: `4px solid ${isNeg ? '#991b1b' : isPos ? '#166534' : sm.color}`,
                opacity: item.status === 'annule' ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: ti.bg, color: ti.color }}>
                        {ti.label}
                      </span>
                      {item.urgence === 'urgente' && (
                        <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>⚠ Urgent</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{item.reference}</div>
                    <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>Période : {item.periode}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sm.color }}>
                      {sm.icon} {sm.label}
                    </div>
                    {item.montant != null && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--abed-green)', marginTop: 4 }}>
                        {Number(item.montant).toLocaleString('fr-FR')} XOF
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>
                      {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <ProgressBar type={item.type} status={item.status} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
