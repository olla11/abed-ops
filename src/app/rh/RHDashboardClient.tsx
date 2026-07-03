'use client'

type Personnel = { id: string; nom: string; prenoms: string; role: string; type_emploi: string | null; direction: string | null; fonction: string | null }
type Contrat = { id: string; type_contrat: string; statut: string; date_fin: string | null; date_debut: string; direction: string | null; poste: string | null; profile_id: string; profile: { nom: string; prenoms: string } | null }
type Conge = { id: string; statut: string; date_debut: string; date_fin: string; nb_jours: number | null; created_at: string; profile: { nom: string; prenoms: string; direction: string | null } | null; type_conge: { nom: string } | null }
type Evaluation = { id: string; statut: string; score_moyen: number | null; declenchee_le: string | null; profile: { nom: string; prenoms: string } | null }

type Props = {
  personnel: Personnel[]
  contrats: Contrat[]
  contratsExpirants: Contrat[]
  congesRecents: Conge[]
  congesEnAttenteCount: number
  evaluations: Evaluation[]
  tauxActivite: number
  activeMoisCount: number
  totalActifs: number
}

const card: React.CSSProperties = {
  background: 'white', border: '1px solid var(--abed-border)',
  borderRadius: 10, padding: '20px 24px',
}

const STATUT_CONGE: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#92400e', bg: '#fef3c7' },
  approuve_n1: { label: 'Approuvé N1', color: '#1e40af', bg: '#dbeafe' },
  approuve: { label: 'Approuvé', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Rejeté', color: '#991b1b', bg: '#fee2e2' },
}

const STATUT_EVAL: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: '#92400e' },
  evaluateur_complete: { label: 'Évaluateur OK', color: '#1e40af' },
  evalue_complete: { label: 'Évalué OK', color: '#5b21b6' },
  responsable_complete: { label: 'Responsable OK', color: '#0f766e' },
  cloture: { label: 'Clôturée', color: '#166534' },
}

export default function RHDashboardClient({ personnel, contrats, contratsExpirants, congesRecents, congesEnAttenteCount, evaluations, tauxActivite, activeMoisCount, totalActifs }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const contratsActifs = contrats.filter(c => c.statut === 'actif').length
  const evalsEnCours = evaluations.filter(e => e.statut !== 'cloture').length

  // Répartition par type d'emploi
  const parType: Record<string, number> = {}
  personnel.forEach(p => {
    const t = p.type_emploi ?? 'non défini'
    parType[t] = (parType[t] ?? 0) + 1
  })
  const typesSorted = Object.entries(parType).sort((a, b) => b[1] - a[1])
  const maxType = typesSorted[0]?.[1] ?? 1

  // Répartition par direction
  const parDir: Record<string, number> = {}
  personnel.forEach(p => {
    const d = p.direction ?? 'Non assigné'
    parDir[d] = (parDir[d] ?? 0) + 1
  })
  const dirsSorted = Object.entries(parDir).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxDir = dirsSorted[0]?.[1] ?? 1

  const TYPE_LABELS: Record<string, string> = {
    benevole: 'Bénévole', stagiaire_n1: 'Stagiaire N1', stagiaire_n2: 'Stagiaire N2',
    cdd: 'CDD', cdi: 'CDI', prestataire_direct: 'Prestataire direct',
    prestataire_credit: 'Prestataire crédit', 'non défini': 'Non défini',
  }

  function daysUntil(dateStr: string) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 24, fontSize: 22 }}>Tableau de bord RH</h2>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Effectif total', value: personnel.length, icon: '👥', color: '#166534', bg: '#dcfce7' },
          { label: 'Contrats actifs', value: contratsActifs, icon: '📄', color: '#1e40af', bg: '#dbeafe' },
          { label: 'Congés en attente', value: congesEnAttenteCount, icon: '🏖', color: '#92400e', bg: '#fef3c7' },
          { label: 'Évaluations en cours', value: evalsEnCours, icon: '📝', color: '#5b21b6', bg: '#ede9fe' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{kpi.label}</div>
            </div>
          </div>
        ))}

        {/* Taux d'activité du mois */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            📊
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: tauxActivite >= 80 ? '#166534' : tauxActivite >= 50 ? '#92400e' : '#991b1b', lineHeight: 1 }}>
                {tauxActivite}%
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{activeMoisCount}/{totalActifs}</div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Activité ce mois</div>
            <div style={{ background: '#f3f4f6', borderRadius: 4, height: 5, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, transition: 'width .4s',
                background: tauxActivite >= 80 ? '#16a34a' : tauxActivite >= 50 ? '#f59e0b' : '#dc2626',
                width: `${tauxActivite}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Alertes contrats */}
      {contratsExpirants.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...card, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
              ⚠️ {contratsExpirants.length} contrat{contratsExpirants.length > 1 ? 's' : ''} expirant bientôt
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contratsExpirants.map(c => {
                const days = c.date_fin ? daysUntil(c.date_fin) : 999
                const urgent = days <= 7
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    background: urgent ? '#fee2e2' : '#fef3c7',
                    border: `1px solid ${urgent ? '#fca5a5' : '#fde68a'}`,
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {c.profile?.prenoms} {c.profile?.nom}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>
                        {c.type_contrat} {c.poste ? `— ${c.poste}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Fin : {c.date_fin}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                        background: urgent ? '#dc2626' : '#f59e0b', color: 'white',
                      }}>
                        J-{days}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Répartition par type d'emploi */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Répartition par type d&apos;emploi</div>
          {typesSorted.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {typesSorted.map(([type, count]) => (
                <div key={type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#374151' }}>{TYPE_LABELS[type] ?? type}</span>
                    <span style={{ fontWeight: 700, color: 'var(--abed-green)' }}>{count} ({Math.round(count / personnel.length * 100)}%)</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--abed-green)', width: `${count / maxType * 100}%`, borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Répartition par direction */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Répartition par direction</div>
          {dirsSorted.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune donnée</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dirsSorted.map(([dir, count]) => (
                <div key={dir}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{dir}</span>
                    <span style={{ fontWeight: 700, color: '#1e40af' }}>{count}</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', width: `${count / maxDir * 100}%`, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Congés récents */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Congés récents</div>
          {congesRecents.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucun congé</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {congesRecents.map(c => {
                const s = STATUT_CONGE[c.statut] ?? { label: c.statut, color: '#374151', bg: '#f3f4f6' }
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.profile?.prenoms} {c.profile?.nom}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{c.type_conge?.nom ?? 'Congé'} · {c.date_debut} → {c.date_fin} {c.nb_jours ? `(${c.nb_jours}j)` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Évaluations récentes */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Évaluations récentes</div>
          {evaluations.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Aucune évaluation</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evaluations.map(e => {
                const s = STATUT_EVAL[e.statut] ?? { label: e.statut, color: '#374151' }
                return (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{e.profile?.prenoms} {e.profile?.nom}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {e.declenchee_le ? `Déclenchée le ${e.declenchee_le.split('T')[0]}` : ''}
                        {e.score_moyen ? ` · Score : ${e.score_moyen}/5` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
