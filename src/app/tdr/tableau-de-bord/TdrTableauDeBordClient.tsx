'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Download, AlertTriangle, Clock, TrendingDown, ListFilter, RotateCcw, FileSpreadsheet } from 'lucide-react'
import { TDR_STATUT_LABELS } from '@/lib/tdr'

export type TdrDashboardRow = {
  id: string
  numero: string | null
  titre_activite: string
  statut: string
  projet: string | null
  budget_total_valide: number | null
  montant_depense: number | null
  execution_statut: 'complete' | 'partielle' | null
  initiateur_id: string
  date_debut_prevue: string | null
  initiateur: { nom: string; prenoms: string } | null
}

export type FactureDashboardRow = { tdr_id: string; montant: number; date_facture: string | null }

type Ligne = { label: string; nb: number; budget: number; depense: number; solde: number; pct: number }

const GREEN = '#63a521'
const BLUE = '#2f5496'
const AMBER = '#b45309'
const RED = '#991b1b'
const BAR_COLORS = ['#63a521', '#4d8019', '#2f5496', '#7c9c6b', '#9ca3af', '#b45309', '#0369a1', '#991b1b', '#6b7280', '#166534']

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR') + ' FCFA' }
function nomResponsable(t: TdrDashboardRow) { return t.initiateur ? `${t.initiateur.prenoms} ${t.initiateur.nom}` : 'Inconnu' }

function agreger(label: string, items: TdrDashboardRow[]): Ligne {
  const budget = items.reduce((s, t) => s + (t.budget_total_valide ?? 0), 0)
  const depense = items.reduce((s, t) => s + (t.montant_depense ?? 0), 0)
  return { label, nb: items.length, budget, depense, solde: budget - depense, pct: budget > 0 ? Math.round((depense / budget) * 1000) / 10 : 0 }
}

function grouper(tdrs: TdrDashboardRow[], cle: (t: TdrDashboardRow) => string): Ligne[] {
  const map = new Map<string, TdrDashboardRow[]>()
  for (const t of tdrs) {
    const k = cle(t)
    map.set(k, [...(map.get(k) ?? []), t])
  }
  return [...map.entries()].map(([label, items]) => agreger(label, items)).sort((a, b) => b.pct - a.pct)
}

function GroupeTable({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  const total = agreger('TOTAL', [])
  for (const l of lignes) { total.nb += l.nb; total.budget += l.budget; total.depense += l.depense; total.solde += l.solde }
  total.pct = total.budget > 0 ? Math.round((total.depense / total.budget) * 1000) / 10 : 0

  return (
    <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
      <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>{titre}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 560 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--abed-border)', color: 'var(--abed-muted)' }}>
            <th style={{ padding: '6px 8px' }}>—</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Nb TdR</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Budget</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Dépensé</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Solde</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>% exéc.</th>
          </tr>
        </thead>
        <tbody>
          {lignes.filter(l => l.nb > 0).map(l => (
            <tr key={l.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '7px 8px', fontWeight: 600 }}>{l.label}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{l.nb}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(l.budget)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(l.depense)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: l.solde < 0 ? '#dc2626' : undefined }}>{fmt(l.solde)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{l.pct}%</td>
            </tr>
          ))}
          {lignes.every(l => l.nb === 0) && (
            <tr><td colSpan={6} style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--abed-muted)' }}>Aucune donnée pour ces filtres.</td></tr>
          )}
          <tr style={{ fontWeight: 800 }}>
            <td style={{ padding: '8px' }}>TOTAL</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{total.nb}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.budget)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.depense)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(total.solde)}</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{total.pct}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Tuile de statistique : puce d'icône teintée + chiffre en encre neutre — pas
// un chiffre coloré en pleine teinte, qui devient vite criard sur une rangée
// de 7 tuiles (cf. AnalyticsClient, même motif dans l'app).
function StatTile({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#1f2a17', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function moisCle(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}
function moisLabel(cle: string): string {
  const [y, m] = cle.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default function TdrTableauDeBordClient({ tdrs, factures }: { tdrs: TdrDashboardRow[]; factures: FactureDashboardRow[] }) {
  const [filtreProjet, setFiltreProjet] = useState('tous')
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [filtreResponsable, setFiltreResponsable] = useState('tous')
  const [exporting, setExporting] = useState(false)

  const projets = useMemo(() => [...new Set(tdrs.map(t => t.projet?.trim() || 'Sans projet'))].sort(), [tdrs])
  const responsables = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tdrs) map.set(t.initiateur_id, nomResponsable(t))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [tdrs])
  const statutsPresents = useMemo(() => [...new Set(tdrs.map(t => t.statut))], [tdrs])

  const filtered = useMemo(() => tdrs.filter(t =>
    (filtreProjet === 'tous' || (t.projet?.trim() || 'Sans projet') === filtreProjet) &&
    (filtreStatut === 'tous' || t.statut === filtreStatut) &&
    (filtreResponsable === 'tous' || t.initiateur_id === filtreResponsable)
  ), [tdrs, filtreProjet, filtreStatut, filtreResponsable])

  const idsFiltres = useMemo(() => new Set(filtered.map(t => t.id)), [filtered])
  const facturesFiltrees = useMemo(() => factures.filter(f => idsFiltres.has(f.tdr_id)), [factures, idsFiltres])

  const global = useMemo(() => agreger('Global', filtered), [filtered])
  const enCours = filtered.filter(t => t.statut === 'actif' || t.statut === 'reconciliation_caf' || t.statut === 'reconciliation_responsable').length
  const clotures = filtered.filter(t => t.statut === 'cloture').length

  const parStatut = useMemo(() => [
    agreger(TDR_STATUT_LABELS.actif, filtered.filter(t => t.statut === 'actif')),
    agreger(TDR_STATUT_LABELS.reconciliation_caf, filtered.filter(t => t.statut === 'reconciliation_caf')),
    agreger(TDR_STATUT_LABELS.reconciliation_responsable, filtered.filter(t => t.statut === 'reconciliation_responsable')),
    agreger('Clôturé — exécution complète', filtered.filter(t => t.statut === 'cloture' && t.execution_statut === 'complete')),
    agreger('Clôturé — exécution partielle', filtered.filter(t => t.statut === 'cloture' && t.execution_statut === 'partielle')),
    agreger('Clôturé — non renseigné', filtered.filter(t => t.statut === 'cloture' && !t.execution_statut)),
  ], [filtered])

  const parProjet = useMemo(() => grouper(filtered, t => t.projet?.trim() || 'Sans projet').sort((a, b) => b.nb - a.nb), [filtered])
  const parResponsable = useMemo(() => grouper(filtered, nomResponsable).sort((a, b) => b.nb - a.nb), [filtered])

  // Classements — seulement les entités avec un budget figé (sinon un
  // % à 0 ne veut rien dire), triés par taux d'exécution décroissant, top 8
  // pour rester lisible sur un bar chart.
  const classementResponsable = useMemo(() => [...parResponsable].filter(l => l.budget > 0).sort((a, b) => b.pct - a.pct).slice(0, 8), [parResponsable])
  const classementProjet = useMemo(() => [...parProjet].filter(l => l.budget > 0).sort((a, b) => b.pct - a.pct).slice(0, 8), [parProjet])

  // Dépense cumulée dans le temps, mois par mois, sur les factures des TdR
  // actuellement filtrés.
  const evolution = useMemo(() => {
    const parMois = new Map<string, number>()
    for (const f of facturesFiltrees) {
      if (!f.date_facture) continue
      const cle = moisCle(f.date_facture)
      parMois.set(cle, (parMois.get(cle) ?? 0) + f.montant)
    }
    const cles = [...parMois.keys()].sort()
    let cumul = 0
    return cles.map(cle => {
      cumul += parMois.get(cle) ?? 0
      return { mois: moisLabel(cle), depenseMois: parMois.get(cle) ?? 0, cumul }
    })
  }, [facturesFiltrees])

  // Alertes — l'outil d'analyse : dépassement/quasi-dépassement de budget,
  // démarrage financier en retard, et anomalie de solde négatif.
  const alertesDepassement = useMemo(() =>
    filtered.filter(t => (t.budget_total_valide ?? 0) > 0 && ((t.montant_depense ?? 0) / (t.budget_total_valide ?? 1)) >= 0.9)
      .sort((a, b) => (b.montant_depense! / b.budget_total_valide!) - (a.montant_depense! / a.budget_total_valide!)),
    [filtered])

  const alertesRetard = useMemo(() => {
    const seuil = Date.now() - 30 * 24 * 60 * 60 * 1000
    return filtered.filter(t => t.statut === 'actif' && (t.montant_depense ?? 0) === 0 && t.date_debut_prevue && new Date(t.date_debut_prevue).getTime() < seuil)
      .sort((a, b) => new Date(a.date_debut_prevue!).getTime() - new Date(b.date_debut_prevue!).getTime())
  }, [filtered])

  const alertesSoldeNegatif = useMemo(() =>
    filtered.filter(t => (t.montant_depense ?? 0) > (t.budget_total_valide ?? 0) && (t.budget_total_valide ?? 0) > 0),
    [filtered])

  function reinitialiserFiltres() { setFiltreProjet('tous'); setFiltreStatut('tous'); setFiltreResponsable('tous') }

  async function exporterExcel() {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(t => ({
        Numéro: t.numero ?? '', Activité: t.titre_activite, Statut: TDR_STATUT_LABELS[t.statut as keyof typeof TDR_STATUT_LABELS] ?? t.statut,
        Projet: t.projet ?? '', Responsable: nomResponsable(t),
        'Budget approuvé (FCFA)': t.budget_total_valide ?? 0, 'Dépensé (FCFA)': t.montant_depense ?? 0,
        'Solde (FCFA)': (t.budget_total_valide ?? 0) - (t.montant_depense ?? 0),
        '% exécution': t.budget_total_valide ? Math.round((t.montant_depense ?? 0) / t.budget_total_valide * 1000) / 10 : 0,
        'Exécution finale': t.execution_statut ?? '',
      }))), 'TdR')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parStatut.filter(l => l.nb > 0).map(l => ({
        Statut: l.label, 'Nb TdR': l.nb, 'Budget (FCFA)': l.budget, 'Dépensé (FCFA)': l.depense, 'Solde (FCFA)': l.solde, '% exéc.': l.pct,
      }))), 'Par statut')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parProjet.map(l => ({
        Projet: l.label, 'Nb TdR': l.nb, 'Budget (FCFA)': l.budget, 'Dépensé (FCFA)': l.depense, 'Solde (FCFA)': l.solde, '% exéc.': l.pct,
      }))), 'Par projet')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(parResponsable.map(l => ({
        Responsable: l.label, 'Nb TdR': l.nb, 'Budget (FCFA)': l.budget, 'Dépensé (FCFA)': l.depense, 'Solde (FCFA)': l.solde, '% exéc.': l.pct,
      }))), 'Par responsable')
      XLSX.writeFile(wb, `tableau-de-bord-tdr-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link href="/tdr" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Tous les TdR</Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: 0 }}>Tableau de bord — Suivi financier des TdR</h2>
        <button onClick={exporterExcel} disabled={exporting} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: 'white', color: 'var(--abed-green)', border: '1px solid var(--abed-green)', cursor: exporting ? 'default' : 'pointer',
        }}>
          <FileSpreadsheet size={15} /> {exporting ? 'Export…' : 'Exporter en Excel'}
        </button>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--abed-muted)', fontSize: 12.5, fontWeight: 600, paddingBottom: 8 }}>
          <ListFilter size={14} /> Filtres
        </div>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label className="label" style={{ fontSize: 11.5 }}>Projet</label>
          <select className="select" value={filtreProjet} onChange={e => setFiltreProjet(e.target.value)}>
            <option value="tous">Tous les projets</option>
            {projets.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label className="label" style={{ fontSize: 11.5 }}>Statut</label>
          <select className="select" value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
            <option value="tous">Tous les statuts</option>
            {statutsPresents.map(s => <option key={s} value={s}>{TDR_STATUT_LABELS[s as keyof typeof TDR_STATUT_LABELS] ?? s}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 180 }}>
          <label className="label" style={{ fontSize: 11.5 }}>Responsable</label>
          <select className="select" value={filtreResponsable} onChange={e => setFiltreResponsable(e.target.value)}>
            <option value="tous">Tous les responsables</option>
            {responsables.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
          </select>
        </div>
        {(filtreProjet !== 'tous' || filtreStatut !== 'tous' || filtreResponsable !== 'tous') && (
          <button onClick={reinitialiserFiltres} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: 'white', color: '#374151', border: '1px solid var(--abed-border)', cursor: 'pointer',
          }}>
            <RotateCcw size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Tuiles de synthèse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 14, marginBottom: 20 }}>
        <StatTile icon={<ListFilter size={18} color="#374151" />} tint="#f3f4f6" label="TdR au total" value={String(global.nb)} />
        <StatTile icon={<Download size={18} color={BLUE} style={{ transform: 'rotate(180deg)' }} />} tint="#eff6ff" label="Budget approuvé" value={fmt(global.budget)} />
        <StatTile icon={<TrendingDown size={18} color={AMBER} style={{ transform: 'scaleY(-1)' }} />} tint="#fffbeb" label="Dépensé" value={fmt(global.depense)} />
        <StatTile icon={<Download size={18} color={GREEN} />} tint="#f0fdf4" label="Solde disponible" value={fmt(global.solde)} />
        <StatTile icon={<ListFilter size={18} color="#6d28d9" />} tint="#f5f3ff" label="% exécution global" value={`${global.pct}%`} />
        <StatTile icon={<Clock size={18} color="#0f766e" />} tint="#f0fdfa" label="En cours d'exécution" value={String(enCours)} />
        <StatTile icon={<ListFilter size={18} color="#6b7280" />} tint="#f3f4f6" label="Clôturés" value={String(clotures)} />
      </div>

      {/* Outil d'analyse : alertes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={16} color={AMBER} /> Alertes
        </h3>

        <div style={{ marginBottom: alertesRetard.length || alertesSoldeNegatif.length ? 16 : 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Proches ou en dépassement de budget (≥ 90 %)</div>
          {alertesDepassement.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: 0 }}>Aucun TdR concerné.</p>
          ) : alertesDepassement.map(t => {
            const pct = Math.round((t.montant_depense! / t.budget_total_valide!) * 1000) / 10
            return (
              <Link key={t.id} href={`/tdr/${t.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.numero ? `${t.numero} — ` : ''}{t.titre_activite}</span>
                <span style={{ fontWeight: 700, color: pct >= 100 ? RED : AMBER, whiteSpace: 'nowrap' }}>{pct}%</span>
              </Link>
            )
          })}
        </div>

        <div style={{ marginBottom: alertesSoldeNegatif.length ? 16 : 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f766e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> Actifs sans dépense, démarrage prévu dépassé de plus de 30 jours
          </div>
          {alertesRetard.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: 0 }}>Aucun TdR concerné.</p>
          ) : alertesRetard.map(t => (
            <Link key={t.id} href={`/tdr/${t.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.numero ? `${t.numero} — ` : ''}{t.titre_activite}</span>
              <span style={{ color: 'var(--abed-muted)', whiteSpace: 'nowrap' }}>début prévu {new Date(t.date_debut_prevue!).toLocaleDateString('fr-FR')}</span>
            </Link>
          ))}
        </div>

        {alertesSoldeNegatif.length > 0 && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: RED, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={13} /> Anomalie — dépense supérieure au budget approuvé
            </div>
            {alertesSoldeNegatif.map(t => (
              <Link key={t.id} href={`/tdr/${t.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.numero ? `${t.numero} — ` : ''}{t.titre_activite}</span>
                <span style={{ fontWeight: 700, color: RED, whiteSpace: 'nowrap' }}>{fmt(t.montant_depense! - t.budget_total_valide!)} au-delà</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Graphiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Taux d&apos;exécution par responsable</h3>
          {classementResponsable.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, classementResponsable.length * 34)}>
              <BarChart data={classementResponsable} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="#9ca3af" unit="%" />
                <YAxis type="category" dataKey="label" width={130} fontSize={11.5} stroke="#6b7280" />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
                <Bar dataKey="pct" name="% exécution" radius={[0, 4, 4, 0]}>
                  {classementResponsable.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>Aucune donnée pour ces filtres.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Taux d&apos;exécution par projet</h3>
          {classementProjet.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, classementProjet.length * 34)}>
              <BarChart data={classementProjet} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="#9ca3af" unit="%" />
                <YAxis type="category" dataKey="label" width={130} fontSize={11.5} stroke="#6b7280" />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
                <Bar dataKey="pct" name="% exécution" radius={[0, 4, 4, 0]}>
                  {classementProjet.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>Aucune donnée pour ces filtres.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Dépense cumulée dans le temps</h3>
        {evolution.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCumul" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="mois" fontSize={11} stroke="#9ca3af" />
              <YAxis fontSize={11} stroke="#9ca3af" tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
              <Area type="monotone" dataKey="cumul" name="Dépense cumulée" stroke={GREEN} fill="url(#fillCumul)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>Aucune facture datée pour ces filtres.</p>
        )}
      </div>

      <GroupeTable titre="Répartition par statut" lignes={parStatut} />
      <GroupeTable titre="Répartition par projet / programme" lignes={parProjet} />
      <GroupeTable titre="Répartition par responsable" lignes={parResponsable} />
    </div>
  )
}
