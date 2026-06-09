'use client'
import { useState, useEffect } from 'react'

type Item = {
  id: string; type: 'timesheet' | 'rapport' | 'om' | 'demande'
  reference: string; concerne: string; type_emploi?: string; sous_type?: string
  periode: string; montant: number | null; status: string; chez_qui: string
  clos: boolean; urgence?: string; departement?: string; created_at: string
  meta?: { lieu?: string; date_fin?: string }
}

const TYPE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  timesheet: { label: 'Timesheet',         color: '#1e40af', bg: '#eff6ff' },
  rapport:   { label: 'Rapport mensuel',   color: '#6d28d9', bg: '#f5f3ff' },
  om:        { label: 'Ordre de mission',  color: '#0f766e', bg: '#f0fdfa' },
  demande:   { label: 'Demande paiement',  color: '#92660b', bg: '#fffbeb' },
}

const STATUS_COLOR: Record<string, string> = {
  // en cours
  soumis: '#92660b', valide_tech: '#1e40af', traite_aaf: '#6d28d9',
  valide_aaf: '#6d28d9', valide_caf: '#0f766e', signe: '#166534',
  corrections_tech: '#9a3412', corrections_caf: '#9a3412',
  // clos positifs
  autorise: '#166534', cloture: '#374151',
  // clos négatifs
  rejete_tech: '#991b1b', rejete_caf: '#991b1b', rejete_aaf: '#991b1b',
  rejete_manager: '#991b1b', rejete_caf2: '#991b1b',
  refuse_caf: '#991b1b', refuse_de: '#991b1b', annule: '#6b7280',
}

function badge(label: string, color: string) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999, background: color + '22', color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function statusLabel(status: string): string {
  const m: Record<string, string> = {
    soumis: 'Soumis', valide_tech: 'Validé tech.', traite_aaf: 'Traité AAF',
    valide_aaf: 'Validé AAF', valide_caf: 'Validé CAF', autorise: '✓ Autorisé',
    signe: 'Signé', cloture: 'Clôturé', annule: 'Annulé',
    corrections_tech: '⚠ Corrections', corrections_caf: '⚠ Corr. CAF',
    rejete_tech: '✗ Rejeté (mgr)', rejete_caf: '✗ Rejeté (CAF)',
    rejete_aaf: '✗ Rejeté (AAF)', rejete_manager: '✗ Rejeté (mgr)',
    refuse_caf: '✗ Refusé (CAF)', refuse_de: '✗ Refusé (DE)',
  }
  return m[status] ?? status
}

export default function OverviewOperations() {
  const [items, setItems]         = useState<Item[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType]   = useState('tous')
  const [filterStatut, setFilterStatut] = useState('en_cours')
  const [filterTexte, setFilterTexte]   = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/overview').then(r => r.json()).then(j => {
      setItems(j.data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = items.filter(it => {
    if (filterType !== 'tous' && it.type !== filterType) return false
    if (filterStatut === 'en_cours' && it.clos) return false
    if (filterStatut === 'clos' && !it.clos) return false
    if (filterTexte) {
      const q = filterTexte.toLowerCase()
      if (!it.reference.toLowerCase().includes(q) &&
          !it.concerne.toLowerCase().includes(q) &&
          !(it.departement ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    enCours: items.filter(i => !i.clos).length,
    timesheets: items.filter(i => i.type === 'timesheet' && !i.clos).length,
    rapports: items.filter(i => i.type === 'rapport' && !i.clos).length,
    om: items.filter(i => i.type === 'om' && !i.clos).length,
    demandes: items.filter(i => i.type === 'demande' && !i.clos).length,
    urgents: items.filter(i => i.urgence === 'urgente' && !i.clos).length,
  }

  if (loading) return <div className="card"><p style={{ fontSize: 14, color: 'var(--abed-muted)' }}>Chargement…</p></div>

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Résumé chiffré ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {[
          { label: 'En cours',    value: stats.enCours,    color: '#374151' },
          { label: 'Timesheets',  value: stats.timesheets, color: '#1e40af' },
          { label: 'Rapports',    value: stats.rapports,   color: '#6d28d9' },
          { label: 'OM',          value: stats.om,         color: '#0f766e' },
          { label: 'Demandes',    value: stats.demandes,   color: '#92660b' },
          { label: '⚠ Urgents',   value: stats.urgents,    color: '#991b1b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: `2px solid ${s.color}22`,
            borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="🔍 Rechercher…" value={filterTexte}
          style={{ maxWidth: 220, fontSize: 13 }}
          onChange={e => setFilterTexte(e.target.value)} />

        <select className="select" value={filterType} style={{ maxWidth: 180, fontSize: 13 }}
          onChange={e => setFilterType(e.target.value)}>
          <option value="tous">Tous les types</option>
          <option value="timesheet">Timesheets</option>
          <option value="rapport">Rapports mensuels</option>
          <option value="om">Ordres de mission</option>
          <option value="demande">Demandes de paiement</option>
        </select>

        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--abed-border)' }}>
          {[['en_cours','En cours'],['clos','Clôturés'],['tous','Tous']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatut(v)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: filterStatut === v ? 700 : 400,
                background: filterStatut === v ? 'var(--abed-green)' : 'white',
                color: filterStatut === v ? 'white' : '#374151',
                border: 'none', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 4 }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Liste ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--abed-muted)', padding: 32, fontSize: 14 }}>
            Aucun dossier correspondant aux filtres.
          </p>
        ) : (
          <div>
            {/* En-tête */}
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 130px 110px 80px',
              gap: 8, padding: '10px 16px', background: '#f9fafb',
              borderBottom: '1px solid var(--abed-border)', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
              <span>Type</span><span>Dossier / Concerné</span>
              <span>Chez qui</span><span>Statut</span>
              <span>Montant</span><span>Date</span>
            </div>

            {filtered.map(it => {
              const tl = TYPE_LABEL[it.type]
              const sc = STATUS_COLOR[it.status] ?? '#374151'
              const isOpen = expanded === it.id
              return (
                <div key={it.id} style={{ borderBottom: '1px solid var(--abed-border)',
                  opacity: it.clos ? 0.7 : 1 }}>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 130px 110px 80px',
                      gap: 8, padding: '11px 16px', cursor: 'pointer', fontSize: 13,
                      background: isOpen ? '#fafafa' : 'white',
                      transition: 'background .1s' }}
                    onClick={() => setExpanded(isOpen ? null : it.id)}>

                    {/* Type */}
                    <div>
                      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 999, background: tl.bg, color: tl.color }}>
                        {tl.label}
                      </span>
                      {it.urgence === 'urgente' && (
                        <span style={{ display: 'block', fontSize: 10, color: '#991b1b', fontWeight: 600, marginTop: 2 }}>⚠ Urgent</span>
                      )}
                    </div>

                    {/* Dossier */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}
                        title={it.reference}>{it.reference}</div>
                      <div style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 1 }}>
                        {it.concerne}
                        {it.type_emploi && <span style={{ marginLeft: 6, textTransform: 'uppercase', fontSize: 10 }}>· {it.type_emploi}</span>}
                      </div>
                    </div>

                    {/* Chez qui */}
                    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.3 }}>{it.chez_qui}</div>

                    {/* Statut */}
                    <div>{badge(statusLabel(it.status), sc)}</div>

                    {/* Montant */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--abed-green)' }}>
                      {it.montant != null ? `${Number(it.montant).toLocaleString('fr-FR')} XOF` : '—'}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 11, color: 'var(--abed-muted)' }}>
                      {new Date(it.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>

                  {/* Détail expandable */}
                  {isOpen && (
                    <div style={{ padding: '12px 16px 16px', background: '#f9fafb',
                      borderTop: '1px solid var(--abed-border)', display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                        <span><strong>Période :</strong> {it.periode}</span>
                        {it.departement && <span><strong>Département :</strong> {it.departement}</span>}
                        {it.meta?.lieu && <span><strong>Lieu :</strong> {it.meta.lieu}</span>}
                        {it.meta?.date_fin && <span><strong>Retour :</strong> {new Date(it.meta.date_fin).toLocaleDateString('fr-FR')}</span>}
                        {it.sous_type && <span><strong>Nature :</strong> {it.sous_type === 'salaire' ? 'Fiche de paie' : 'Allocation'}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        <strong>Circuit :</strong> {it.chez_qui}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {it.type === 'rapport' && it.clos && it.status === 'autorise' && (
                          <a href={`/api/rapports-allocations/${it.id}/etat-paiement-pdf`} target="_blank"
                            className="btn secondary" style={{ fontSize: 12, textDecoration: 'none', padding: '4px 12px' }}>
                            📄 PDF
                          </a>
                        )}
                        {it.type === 'om' && (
                          <a href={`/dashboard`} className="btn secondary"
                            style={{ fontSize: 12, textDecoration: 'none', padding: '4px 12px' }}>
                            Voir OM →
                          </a>
                        )}
                        {it.type === 'demande' && (
                          <a href={`/demandes`} className="btn secondary"
                            style={{ fontSize: 12, textDecoration: 'none', padding: '4px 12px' }}>
                            Voir demande →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
