'use client'
import React from 'react'
import Link from 'next/link'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'
import { PenLine, Plane, FolderOpen, FileCheck } from 'lucide-react'

export type Mission = {
  id: string
  reference: string | null
  objet: string
  lieu: string
  date_depart: string
  date_retour: string
  status: string
  missionnaire_id: string
  missionnaire?: { nom: string; prenoms: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', soumis: 'Soumis', signe: 'Signé',
  en_mission: 'En mission', reconciliation: 'Réconciliation',
  reconciliation_aaf: 'Validation AAF', reconciliation_caf: 'Validation CAF',
  reconciliation_de: 'Autorisation DE',
  paiement_attente: 'Paiement en attente', cloture: 'Clôturé', rejete: 'Rejeté',
}

function MissionsTableSimple({ missions, showMissionnaire }: { missions: Mission[]; showMissionnaire: boolean }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = missions.filter(m =>
    !search ||
    m.objet.toLowerCase().includes(search.toLowerCase()) ||
    (m.reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
    m.lieu.toLowerCase().includes(search.toLowerCase()) ||
    `${(m.missionnaire as any)?.prenoms} ${(m.missionnaire as any)?.nom}`.toLowerCase().includes(search.toLowerCase())
  )
  const paged = paginate(filtered, page, 10)

  return (
    <>
      <input
        placeholder="Rechercher (référence, objet, lieu…)"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
        style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--abed-border)', fontSize: 13, outline: 'none', width: '100%', maxWidth: 340, marginBottom: 12, boxSizing: 'border-box' }}
      />
      <div className="table-wrap">
        <table style={{ minWidth: showMissionnaire ? 900 : 750 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {showMissionnaire && <col style={{ width: 160 }} />}
            <col style={{ width: showMissionnaire ? 260 : 340 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Référence</th>
              {showMissionnaire && <th>Missionnaire</th>}
              <th>Objet</th>
              <th>Lieu</th>
              <th>Période</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.map(m => (
              <tr key={m.id}>
                <td title={m.reference ?? '—'} style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.reference ?? '—'}</td>
                {showMissionnaire && (
                  <td style={{ fontSize: 13 }}>
                    {(m.missionnaire as any)?.prenoms} {(m.missionnaire as any)?.nom}
                  </td>
                )}
                <td title={m.objet}>{m.objet}</td>
                <td title={m.lieu}>{m.lieu}</td>
                <td style={{ fontSize: 12 }}>
                  {new Date(m.date_depart).toLocaleDateString('fr-FR')} → {new Date(m.date_retour).toLocaleDateString('fr-FR')}
                </td>
                <td><span className={`badge ${m.status}`}>{STATUS_LABELS[m.status] ?? m.status}</span></td>
                <td><Link href={`/missions/${m.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ouvrir</Link></td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={showMissionnaire ? 7 : 6} style={{ color: 'var(--abed-muted)', textAlign: 'center', padding: '28px 0' }}>
                  Aucune mission.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filtered.length} pageSize={10} onChange={setPage} />
    </>
  )
}

type ActionTab = {
  key: string
  label: string
  filter: (missions: Mission[]) => Mission[]
  banner: (count: number) => { title: string; desc: string }
  icon: React.ElementType
}

const SIGNER_TAB: ActionTab = {
  key: 'signer',
  label: 'À signer',
  filter: (missions) => missions.filter(m => m.status === 'soumis'),
  banner: (n) => ({
    title: `${n} ordre${n > 1 ? 's' : ''} en attente de votre signature`,
    desc: 'Ces missions ont été soumises et nécessitent votre signature pour être officialisées.',
  }),
  icon: PenLine,
}

const VALIDER_AAF_TAB: ActionTab = {
  key: 'valider_aaf',
  label: 'Réconciliations à valider (AAF)',
  filter: (missions) => missions.filter(m => m.status === 'reconciliation_aaf'),
  banner: (n) => ({
    title: `${n} réconciliation${n > 1 ? 's' : ''} en attente de votre validation`,
    desc: 'Vérifiez le point financier et le rapport de mission avant transmission à la CAF.',
  }),
  icon: FileCheck,
}

const VALIDER_CAF_TAB: ActionTab = {
  key: 'valider_caf',
  label: 'Réconciliations à valider (CAF)',
  filter: (missions) => missions.filter(m => m.status === 'reconciliation_caf'),
  banner: (n) => ({
    title: `${n} réconciliation${n > 1 ? 's' : ''} en attente de votre validation`,
    desc: 'Validez ou rejetez la réconciliation avant transmission au Directeur Exécutif.',
  }),
  icon: FileCheck,
}

const AUTORISER_DE_TAB: ActionTab = {
  key: 'autoriser_de',
  label: 'Réconciliations à autoriser (DE)',
  filter: (missions) => missions.filter(m => m.status === 'reconciliation_de'),
  banner: (n) => ({
    title: `${n} réconciliation${n > 1 ? 's' : ''} en attente de votre autorisation`,
    desc: 'Déjà validées par l\'AAF et la CAF. Votre autorisation clôture définitivement la mission.',
  }),
  icon: FileCheck,
}

export default function MissionsTable({
  missions,
  isManager,
  isSignataire,
  isAAF,
  canValidateReconc,
  canAutoriserDE,
  userId,
}: {
  missions: Mission[]
  isManager: boolean
  isSignataire: boolean
  isAAF: boolean
  canValidateReconc: boolean
  canAutoriserDE: boolean
  userId: string
}) {
  const actionTabs: ActionTab[] = [
    ...(isSignataire ? [SIGNER_TAB] : []),
    ...(isAAF ? [VALIDER_AAF_TAB] : []),
    ...(canValidateReconc ? [VALIDER_CAF_TAB] : []),
    ...(canAutoriserDE ? [AUTORISER_DE_TAB] : []),
  ]
  const hasTabs = actionTabs.length > 0 || isAAF

  const [tab, setTab] = useState<string>(actionTabs[0]?.key ?? 'mes')

  if (!hasTabs) {
    // Vue simple : missionnaire standard, manager non-signataire/AAF (rh)
    return <MissionsTableSimple missions={missions} showMissionnaire={isManager} />
  }

  const mesMissions = missions.filter(m => m.missionnaire_id === userId)

  const tabs: { key: string; label: string; count?: number; icon: React.ElementType; color?: string }[] = [
    ...actionTabs.map(t => {
      const filtered = t.filter(missions).filter(m => m.missionnaire_id !== userId)
      return { key: t.key, label: t.label, count: filtered.length, icon: t.icon, color: filtered.length > 0 ? '#b45309' : undefined }
    }),
    { key: 'mes', label: 'Mes ordres de mission', icon: Plane },
    { key: 'tous', label: 'Tous les ordres', icon: FolderOpen },
  ]

  return (
    <div>
      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 8,
                padding: '9px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
                background: active ? 'var(--abed-green)' : 'transparent',
                color: active ? 'white' : (t.color ?? '#374151'),
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              }}
            >
              <t.icon size={16} strokeWidth={2} />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
                  background: active ? 'rgba(255,255,255,.25)' : '#fef3c7',
                  color: active ? 'white' : '#92400e',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Contenu des onglets d'action */}
      {actionTabs.map(t => {
        if (tab !== t.key) return null
        const list = t.filter(missions).filter(m => m.missionnaire_id !== userId)
        const b = t.banner(list.length)
        return (
          <div key={t.key}>
            {list.length > 0 ? (
              <>
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⏳</span>
                  <div>
                    <strong style={{ fontSize: 14, color: '#92400e' }}>{b.title}</strong>
                    <p style={{ fontSize: 12, color: '#b45309', margin: '2px 0 0' }}>{b.desc}</p>
                  </div>
                </div>
                <MissionsTableSimple missions={list} showMissionnaire={true} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Rien en attente</p>
                <p style={{ fontSize: 13 }}>Aucun ordre de mission ne nécessite votre action pour le moment.</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Contenu onglet Mes missions */}
      {tab === 'mes' && (
        <div>
          {mesMissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--abed-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucune mission personnelle</p>
              <p style={{ fontSize: 13 }}>Vous n'avez pas encore soumis d'ordre de mission.</p>
            </div>
          ) : (
            <MissionsTableSimple missions={mesMissions} showMissionnaire={false} />
          )}
        </div>
      )}

      {/* Contenu onglet Tous les ordres */}
      {tab === 'tous' && (
        <MissionsTableSimple missions={missions} showMissionnaire={true} />
      )}
    </div>
  )
}
