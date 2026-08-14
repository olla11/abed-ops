'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Search, CheckCircle2, BarChart3 } from 'lucide-react'
import { TDR_STATUT_LABELS, STATUT_TOUR, type TdrStatut } from '@/lib/tdr'
import Pagination, { paginate } from '@/components/Pagination'
import type { TdrLite } from './page'

const PAGE_SIZE = 10

const STATUT_COLORS: Record<string, { bg: string; color: string }> = {
  brouillon: { bg: '#f3f4f6', color: '#6b7280' },
  en_validation_technique: { bg: '#fffbeb', color: '#92400e' },
  en_validation_caf: { bg: '#fffbeb', color: '#92400e' },
  en_autorisation_de: { bg: '#fffbeb', color: '#92400e' },
  actif: { bg: '#f0fdf4', color: '#16a34a' },
  reconciliation_caf: { bg: '#eff6ff', color: '#2563eb' },
  reconciliation_responsable: { bg: '#eff6ff', color: '#2563eb' },
  cloture: { bg: '#f3f4f6', color: '#374151' },
}

function StatutBadge({ statut }: { statut: string }) {
  const c = STATUT_COLORS[statut] ?? STATUT_COLORS.brouillon
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {TDR_STATUT_LABELS[statut as TdrStatut] ?? statut}
    </span>
  )
}

function estMonTour(tdr: TdrLite, myId: string): boolean {
  const roleAttendu = STATUT_TOUR[tdr.statut as TdrStatut]
  if (!roleAttendu) return false
  return tdr.signataires.some(s => s.role === roleAttendu && s.profile_id === myId)
}

export default function TdrListClient({ tdrs, myId, myRole }: { tdrs: TdrLite[]; myId: string; myRole: string }) {
  const accesSuiviFinancier = ['aaf', 'caf', 'de', 'admin', 'superadmin'].includes(myRole)
  const router = useRouter()
  const [tab, setTab] = useState<'mes' | 'signer' | 'actifs' | 'archives'>('mes')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  function changeTab(t: typeof tab) { setTab(t); setPage(1) }
  function changeSearch(v: string) { setSearch(v); setPage(1) }

  const mesTdrs = tdrs.filter(t => t.initiateur_id === myId || t.collaborateurs.some(c => c.profile_id === myId))
  const aSignerTdrs = tdrs.filter(t => estMonTour(t, myId))
  const actifsTdrs = tdrs.filter(t => (t.statut === 'actif' || t.statut === 'reconciliation_caf' || t.statut === 'reconciliation_responsable' || t.statut === 'cloture') && !t.archive_le)
  // Archivés automatiquement (TDR clôturés de l'année civile précédente, le
  // 31 janvier) — retirés de "Tous les TDR actifs" mais toujours consultables
  // ici, avec la même règle de visibilité (RLS) que les autres onglets.
  const archivesTdrs = tdrs.filter(t => !!t.archive_le)

  const byTab = tab === 'mes' ? mesTdrs : tab === 'signer' ? aSignerTdrs : tab === 'archives' ? archivesTdrs : actifsTdrs

  const items = search.trim()
    ? byTab.filter(t => t.titre_activite.toLowerCase().includes(search.trim().toLowerCase()) || (t.numero ?? '').toLowerCase().includes(search.trim().toLowerCase()))
    : byTab

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const TABS = [
    { key: 'mes' as const, label: 'Mes TdR', count: mesTdrs.length },
    { key: 'signer' as const, label: 'À signer', count: aSignerTdrs.length },
    { key: 'actifs' as const, label: 'Tous les TdR actifs', count: actifsTdrs.length },
    { key: 'archives' as const, label: 'Archives', count: archivesTdrs.length },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Termes de référence (TdR)</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
            Rédaction, collaboration et signature des TdR de l&apos;organisation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {accesSuiviFinancier && (
            <Link href="/tdr/tableau-de-bord" style={{
              padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'white', color: '#374151', border: '1px solid var(--abed-border)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}>
              <BarChart3 size={15} /> Tableau de bord
            </Link>
          )}
          <Link href="/tdr/nouveau" style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'var(--abed-green)', color: 'white', border: 'none', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <Plus size={15} /> Nouveau TdR
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, margin: '20px 0', background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => changeTab(t.key)}
            style={{
              padding: '9px 20px', fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
              cursor: 'pointer', border: 'none', borderRadius: 8,
              background: tab === t.key ? 'var(--abed-green)' : 'transparent',
              color: tab === t.key ? 'white' : '#374151',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <FileText size={16} /> {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                background: tab === t.key ? 'rgba(255,255,255,.25)' : '#e5e7eb',
                color: tab === t.key ? 'white' : '#6b7280',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: 340, marginBottom: 18 }}>
        <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={e => changeSearch(e.target.value)}
          placeholder="Rechercher un TdR (titre, numéro)..."
          style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, fontSize: 14, border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          <CheckCircle2 size={32} style={{ marginBottom: 10 }} />
          <div>{search.trim() ? 'Aucun TdR ne correspond à cette recherche.' : 'Aucun TdR ici pour le moment.'}</div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Activité</th>
                  <th>Projet</th>
                  <th>Responsable</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {paginate(items, safePage, PAGE_SIZE).map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer', opacity: t.importe_historique ? 0.55 : 1 }}
                    title={t.importe_historique ? 'TdR importé du suivi Excel historique (non créé dans le système)' : undefined}
                    onClick={() => router.push(`/tdr/${t.id}`)}>
                    <td style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{t.numero ?? '—'}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', minWidth: 220 }}>{t.titre_activite}</td>
                    <td style={{ fontSize: 13 }}>{t.projet ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{t.initiateur ? `${t.initiateur.prenoms} ${t.initiateur.nom}` : '—'}</td>
                    <td><StatutBadge statut={t.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  )
}
