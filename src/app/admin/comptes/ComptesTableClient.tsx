'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Pagination, { paginate } from '@/components/Pagination'
import ManagerAssignSelect from '@/components/ManagerAssignSelect'
import UserArchiveButton from '../UserArchiveButton'

const PAGE_SIZE = 10

type User = {
  id: string; civilite?: string; nom: string; prenoms: string
  email: string; telephone?: string | null; role?: string
  fonction?: string | null; type_emploi?: string | null; manager_id?: string | null
  archived?: boolean; archived_at?: string | null; archived_reason?: string | null
}

export default function ComptesTableClient({
  users, managers, canManage, isAdmin,
}: {
  users: User[]
  managers: User[]
  canManage: boolean
  isAdmin: boolean
}) {
  const ta = useTranslations('admin')
  const tc = useTranslations('common')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showArchived, setShowArchived] = useState(false)

  const actifs = users.filter(u => !u.archived)
  const archives = users.filter(u => u.archived)

  const list = showArchived ? archives : actifs
  const filtered = search.trim()
    ? list.filter(u => `${u.prenoms} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
    : list

  const paged = paginate(filtered, page, PAGE_SIZE)

  const colSpan = [true, canManage, isAdmin].filter(Boolean).length + 6

  function renderTable(rows: User[]) {
    return (
      <div className="table-wrap">
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>{ta('civilTitle')}</th>
              <th>{ta('nameAndFirstname')}</th>
              <th>{tc('email')}</th>
              <th>{tc('role')}</th>
              <th>{ta('employmentType')}</th>
              <th>{ta('function')}</th>
              {canManage && !showArchived && <th>{ta('directManager')}</th>}
              {showArchived && <th>{ta('archiveDate')}</th>}
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} style={u.archived ? { opacity: 0.6, background: '#f9fafb' } : {}}>
                <td style={{ fontSize: 12 }}>{u.civilite ?? 'M.'}</td>
                <td style={{ fontWeight: 600 }}>{u.prenoms} {u.nom}</td>
                <td style={{ fontSize: 12 }}>{u.email}</td>
                <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                <td style={{ fontSize: 11, color: 'var(--abed-muted)' }}>{u.type_emploi ?? '—'}</td>
                <td style={{ fontSize: 12 }}>{u.fonction ?? '—'}</td>
                {canManage && !showArchived && (
                  <td>
                    <ManagerAssignSelect
                      userId={u.id}
                      currentManagerId={u.manager_id ?? null}
                      managers={managers.filter(m => m.id !== u.id) as any}
                    />
                  </td>
                )}
                {showArchived && (
                  <td style={{ fontSize: 12, color: '#92400e' }}>
                    {u.archived_reason ?? '—'}
                    {u.archived_at && (
                      <span style={{ display: 'block', fontSize: 11, color: '#9ca3af' }}>
                        {new Date(u.archived_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </td>
                )}
                {isAdmin && (
                  <td>
                    <UserArchiveButton userId={u.id} name={`${u.prenoms} ${u.nom}`} archived={!!u.archived} />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={colSpan} style={{ color: 'var(--abed-muted)', textAlign: 'center', padding: '24px 0' }}>
                {showArchived ? ta('noArchived') : ta('noAccounts')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      {/* Barre de recherche + toggle archivés */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 280, fontSize: 13 }}
          placeholder={ta('searchPlaceholder')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          {filtered.length} {tc('noResults').replace('Aucun', '').trim() || 'compte(s)'}
          {!showArchived && archives.length > 0 && (
            <span style={{ marginLeft: 6, color: '#9ca3af' }}>({archives.length} {ta('archived').toLowerCase()})</span>
          )}
        </span>
        {archives.length > 0 && (
          <button
            onClick={() => { setShowArchived(v => !v); setSearch(''); setPage(1) }}
            style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              background: showArchived ? '#92400e' : 'white',
              color: showArchived ? 'white' : '#92400e',
              border: '1px solid #92400e', fontWeight: 600,
            }}
          >
            {showArchived ? `← ${ta('activeAccounts')}` : `${ta('archived')} (${archives.length})`}
          </button>
        )}
      </div>

      {renderTable(paged)}
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  )
}
