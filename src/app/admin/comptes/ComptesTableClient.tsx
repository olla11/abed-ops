'use client'
import { useState } from 'react'
import Pagination, { paginate } from '@/components/Pagination'
import ManagerAssignSelect from '@/components/ManagerAssignSelect'
import UserDeleteButton from '../UserDeleteButton'

const PAGE_SIZE = 10

type User = {
  id: string; civilite?: string; nom: string; prenoms: string
  email: string; telephone?: string | null; role?: string
  fonction?: string | null; type_emploi?: string | null; manager_id?: string | null
}

export default function ComptesTableClient({
  users, managers, canManage, isAdmin,
}: {
  users: User[]
  managers: User[]
  canManage: boolean
  isAdmin: boolean
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = search.trim()
    ? users.filter(u => `${u.prenoms} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
    : users

  const paged = paginate(filtered, page, PAGE_SIZE)

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <input
          className="input"
          style={{ maxWidth: 280, fontSize: 13 }}
          placeholder="Rechercher nom, prénom, email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
          {filtered.length} compte{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="table-wrap">
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Civ.</th>
              <th>Nom &amp; Prénoms</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Rôle</th>
              <th>Type emploi</th>
              <th>Fonction</th>
              {canManage && <th>Responsable direct</th>}
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(u => (
              <tr key={u.id}>
                <td style={{ fontSize: 12 }}>{u.civilite ?? 'M.'}</td>
                <td style={{ fontWeight: 600 }}>{u.prenoms} {u.nom}</td>
                <td style={{ fontSize: 12 }}>{u.email}</td>
                <td style={{ fontSize: 12 }}>{u.telephone ?? '—'}</td>
                <td><span className={`badge ${u.role}`}>{u.role?.toUpperCase()}</span></td>
                <td style={{ fontSize: 11, color: 'var(--abed-muted)' }}>{u.type_emploi ?? '—'}</td>
                <td style={{ fontSize: 12 }}>{u.fonction ?? '—'}</td>
                {canManage && (
                  <td>
                    <ManagerAssignSelect
                      userId={u.id}
                      currentManagerId={u.manager_id ?? null}
                      managers={managers.filter(m => m.id !== u.id) as any}
                    />
                  </td>
                )}
                {isAdmin && (
                  <td><UserDeleteButton userId={u.id} name={`${u.prenoms} ${u.nom}`} /></td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ color: 'var(--abed-muted)', textAlign: 'center' }}>Aucun compte.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  )
}
