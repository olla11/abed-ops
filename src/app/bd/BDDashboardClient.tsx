'use client'
import Link from 'next/link'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { STATUT_LABELS, STATUT_COLORS, STATUTS_TERMINES, type OpportuniteStatut } from '@/lib/bd'

type Opportunite = {
  id: string
  statut: OpportuniteStatut
  bailleur: string | null
  date_identification: string
  date_soumission: string | null
  montant_demande: number | null
  montant_obtenu: number | null
}

function StatCard({ label, count, color, sub }: { label: string; count: number | string; color: string; sub?: string }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: '18px 20px' }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function fmtFcfa(n: number) {
  return `${n.toLocaleString('fr-FR')} FCFA`
}

export default function BDDashboardClient({ opportunites }: { opportunites: Opportunite[] }) {
  const anneeActuelle = new Date().getFullYear()
  const opportunitesAnnee = opportunites.filter(o => new Date(o.date_identification).getFullYear() === anneeActuelle)

  const nbIdentifiees = opportunitesAnnee.length
  const nbSoumises = opportunitesAnnee.filter(o => ['soumis', ...STATUTS_TERMINES].includes(o.statut)).length
  const nbAccepte = opportunitesAnnee.filter(o => o.statut === 'accepte').length
  const nbRefuse = opportunitesAnnee.filter(o => o.statut === 'refuse').length
  const nbSansReponse = opportunitesAnnee.filter(o => o.statut === 'sans_reponse').length
  const nbEnAttente = opportunitesAnnee.filter(o => o.statut === 'soumis').length
  const nbReponsesResolues = nbAccepte + nbRefuse
  const tauxSoumission = nbIdentifiees > 0 ? Math.round((nbSoumises / nbIdentifiees) * 100) : 0
  const tauxSucces = nbReponsesResolues > 0 ? Math.round((nbAccepte / nbReponsesResolues) * 100) : 0

  const montantDemande = opportunitesAnnee.reduce((s, o) => s + (Number(o.montant_demande) || 0), 0)
  const montantObtenu = opportunitesAnnee.reduce((s, o) => s + (Number(o.montant_obtenu) || 0), 0)

  const repartition = (Object.keys(STATUT_LABELS) as OpportuniteStatut[]).map(statut => ({
    statut,
    label: STATUT_LABELS[statut],
    count: opportunitesAnnee.filter(o => o.statut === statut).length,
  })).filter(r => r.count > 0)

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Tableau de bord BD — {anneeActuelle}</h2>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
          Vue d&apos;ensemble du pipeline de financement sur l&apos;année en cours.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard label="Identifiées" count={nbIdentifiees} color="#374151" />
        <StatCard label="Soumises" count={nbSoumises} color="#1e40af" sub={`${tauxSoumission}% des identifiées`} />
        <StatCard label="En attente de réponse" count={nbEnAttente} color="#b45309" />
        <StatCard label="Acceptées" count={nbAccepte} color="#166534" sub={nbReponsesResolues > 0 ? `${tauxSucces}% de taux de succès` : undefined} />
        <StatCard label="Refusées" count={nbRefuse} color="#991b1b" />
        <StatCard label="Sans réponse" count={nbSansReponse} color="#78716c" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Montant total demandé" count={fmtFcfa(montantDemande)} color="#6d28d9" />
        <StatCard label="Montant total obtenu" count={fmtFcfa(montantObtenu)} color="#0f766e" />
      </div>

      {repartition.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Répartition par statut</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, repartition.length * 40)}>
            <BarChart data={repartition} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {repartition.map(r => <Cell key={r.statut} fill={STATUT_COLORS[r.statut]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/bd/opportunites" className="btn">Voir les opportunités</Link>
        <Link href="/bd/calendrier" className="btn secondary">Voir le calendrier</Link>
      </div>
    </div>
  )
}
