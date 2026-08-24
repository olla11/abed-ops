'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Target, Send, Clock, CheckCircle2, XCircle, HelpCircle, Wallet, TrendingUp, Plus, CalendarDays } from 'lucide-react'
import { STATUT_LABELS, STATUT_COLORS, STATUTS_TERMINES, type OpportuniteStatut } from '@/lib/bd'

type Opportunite = {
  id: string
  titre: string
  statut: OpportuniteStatut
  bailleur: string | null
  date_identification: string
  date_soumission: string | null
  date_limite: string | null
  montant_demande: number | null
  montant_obtenu: number | null
}

function fmtFcfa(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M FCFA`
  return `${n.toLocaleString('fr-FR')} FCFA`
}

function KpiCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{
      background: color + '0a', borderRadius: 12, padding: '14px 16px', border: `1px solid ${color}25`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color + '20', color, flexShrink: 0,
        }}>
          <Icon size={15} strokeWidth={2.3} />
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 500 }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
      {children}
    </div>
  )
}

export default function BDDashboardClient({ opportunites, peutGerer }: { opportunites: Opportunite[]; peutGerer: boolean }) {
  const anneeActuelle = new Date().getFullYear()
  const [annee, setAnnee] = useState<number | 'toutes'>(anneeActuelle)
  const anneesDisponibles = Array.from(new Set([anneeActuelle, ...opportunites.map(o => new Date(o.date_identification).getFullYear())])).sort((a, b) => b - a)
  const opportunitesAnnee = annee === 'toutes' ? opportunites : opportunites.filter(o => new Date(o.date_identification).getFullYear() === annee)
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0)

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
  const tauxConversionValeur = montantDemande > 0 ? Math.round((montantObtenu / montantDemande) * 100) : 0

  const repartition = (Object.keys(STATUT_LABELS) as OpportuniteStatut[])
    .map(statut => ({ statut, name: STATUT_LABELS[statut], value: opportunitesAnnee.filter(o => o.statut === statut).length }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const repartitionMax = Math.max(1, ...repartition.map(r => r.value))

  // "À surveiller" ne retient que les échéances encore à venir (0 à 15
  // jours) — le passé (délai dépassé sans soumission) est déjà signalé
  // comme sa propre catégorie dans le registre des opportunités.
  const aSurveiller = opportunitesAnnee
    .filter(o => o.date_limite && (o.statut === 'identifie' || o.statut === 'en_preparation'))
    .map(o => ({ ...o, jours: Math.round((new Date(o.date_limite as string).setHours(0, 0, 0, 0) - aujourdhui.getTime()) / 86400000) }))
    .filter(o => o.jours >= 0 && o.jours <= 15)
    .sort((a, b) => a.jours - b.jours)
    .slice(0, 10)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ color: '#111827', margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Tableau de bord BD</h2>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>
            Pipeline de financement — {annee === 'toutes' ? 'toutes années' : `année ${annee}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={annee}
            onChange={e => setAnnee(e.target.value === 'toutes' ? 'toutes' : Number(e.target.value))}
            style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, color: '#374151',
              border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer',
            }}
          >
            <option value="toutes">Toutes les années</option>
            {anneesDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {peutGerer && (
            <Link href="/bd/opportunites/nouveau" className="btn" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Nouvelle opportunité
            </Link>
          )}
        </div>
      </div>

      <SectionLabel>Pipeline</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 26 }}>
        <KpiCard icon={Target} label="Identifiées" value={nbIdentifiees} color="#475569" />
        <KpiCard icon={Send} label="Soumises" value={nbSoumises} color="#1e40af" sub={`${tauxSoumission}% des identifiées`} />
        <KpiCard icon={Clock} label="En attente de réponse" value={nbEnAttente} color="#b45309" />
      </div>

      <SectionLabel>Résultats</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 26 }}>
        <KpiCard icon={CheckCircle2} label="Acceptées" value={nbAccepte} color="#166534" sub={nbReponsesResolues > 0 ? `${tauxSucces}% de taux de succès` : undefined} />
        <KpiCard icon={XCircle} label="Refusées" value={nbRefuse} color="#991b1b" />
        <KpiCard icon={HelpCircle} label="Sans réponse" value={nbSansReponse} color="#78716c" />
      </div>

      <SectionLabel>Finance</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard icon={Wallet} label="Montant total demandé" value={fmtFcfa(montantDemande)} color="#6d28d9" />
        <KpiCard icon={TrendingUp} label="Montant total obtenu" value={fmtFcfa(montantObtenu)} color="#0f766e" sub={montantDemande > 0 ? `${tauxConversionValeur}% du montant demandé` : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1.3fr)', gap: 16 }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 22, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,.04)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Répartition par statut</h3>
          {repartition.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucune opportunité cette année.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'space-evenly' }}>
              {repartition.map(r => {
                const pct = Math.round((r.value / repartitionMax) * 100)
                const partTotale = Math.round((r.value / opportunitesAnnee.length) * 100)
                return (
                  <div key={r.statut}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                      <span style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 800, color: '#111827' }}>{r.value}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 5 }}>({partTotale}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 6, background: '#f3f4f6', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: STATUT_COLORS[r.statut] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: 22, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CalendarDays size={16} color="#b45309" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>À surveiller (15 prochains jours)</h3>
          </div>
          {aSurveiller.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Rien à surveiller pour l&apos;instant.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
              {aSurveiller.map(o => (
                <Link key={o.id} href={`/bd/opportunites/${o.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, border: '1px solid #f3f4f6', textDecoration: 'none',
                  background: '#fafafa',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titre}</div>
                    <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>{o.bailleur ?? 'Bailleur non précisé'}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, flexShrink: 0, padding: '3px 9px', borderRadius: 20,
                    color: o.jours === 0 ? '#b45309' : '#1e40af',
                    background: o.jours === 0 ? '#fef3c7' : '#dbeafe',
                  }}>
                    {o.jours === 0 ? "Aujourd'hui" : `Dans ${o.jours}j`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <Link href="/bd/opportunites" className="btn secondary">Voir les opportunités</Link>
        <Link href="/bd/calendrier" className="btn secondary">Voir le calendrier</Link>
      </div>
    </div>
  )
}
