'use client'

type Pointage = {
  id: string
  type: 'entree' | 'sortie'
  statut: 'reussi' | 'hors_perimetre' | 'echec_facial'
  horodatage: string
  distance_bureau_m: number
  verification_faciale_effectuee: boolean
  profile: { nom: string; prenoms: string } | null
}

const STATUT_LABELS: Record<Pointage['statut'], { label: string; color: string; bg: string }> = {
  reussi: { label: 'Réussi', color: '#166534', bg: '#dcfce7' },
  hors_perimetre: { label: 'Hors périmètre', color: '#991b1b', bg: '#fee2e2' },
  echec_facial: { label: 'Échec facial', color: '#991b1b', bg: '#fee2e2' },
}

export default function BadgeHistoriqueTable({ pointages }: { pointages: Pointage[] }) {
  if (pointages.length === 0) {
    return <div className="card"><p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>Aucun pointage pour l&apos;instant.</p></div>
  }

  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--abed-border)' }}>
            <th style={{ padding: '10px 14px' }}>Agent</th>
            <th style={{ padding: '10px 14px' }}>Type</th>
            <th style={{ padding: '10px 14px' }}>Date/heure</th>
            <th style={{ padding: '10px 14px' }}>Distance</th>
            <th style={{ padding: '10px 14px' }}>Vérif. faciale</th>
            <th style={{ padding: '10px 14px' }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {pointages.map(p => {
            const s = STATUT_LABELS[p.statut]
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 14px' }}>{p.profile ? `${p.profile.prenoms} ${p.profile.nom}` : '—'}</td>
                <td style={{ padding: '10px 14px' }}>{p.type === 'entree' ? 'Entrée' : 'Sortie'}</td>
                <td style={{ padding: '10px 14px' }}>{new Date(p.horodatage).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '10px 14px' }}>{Math.round(p.distance_bureau_m)} m</td>
                <td style={{ padding: '10px 14px' }}>{p.verification_faciale_effectuee ? 'Oui' : 'Non'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 600 }}>
                    {s.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
