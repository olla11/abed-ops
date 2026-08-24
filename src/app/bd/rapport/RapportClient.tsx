'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileDown, FileText, TrendingUp } from 'lucide-react'
import { STATUT_LABELS, STATUT_COLORS, TYPE_OPPORTUNITE_LABELS, type OpportuniteStatut, type TypeOpportunite } from '@/lib/bd'

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const TRIMESTRES = [
  { value: 1, label: 'T1 — Janvier à Mars' },
  { value: 2, label: 'T2 — Avril à Juin' },
  { value: 3, label: 'T3 — Juillet à Septembre' },
  { value: 4, label: 'T4 — Octobre à Décembre' },
]

type Opportunite = {
  id: string
  titre: string
  bailleur: string | null
  type_opportunite: TypeOpportunite
  statut: OpportuniteStatut
  date_identification: string
  date_soumission: string | null
  montant_demande: number | null
  montant_obtenu: number | null
  responsable: { nom: string; prenoms: string } | null
}

type Apercu = { periodeLabel: string; identifiees: Opportunite[]; soumises: Opportunite[] }

function fmtFcfa(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M FCFA`
  return `${n.toLocaleString('fr-FR')} FCFA`
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

function Tile({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{
      background: color + '0a', borderRadius: 12, padding: '14px 16px', border: `1px solid ${color}25`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function RapportClient() {
  const anneeActuelle = new Date().getFullYear()
  const [periodeType, setPeriodeType] = useState<'mensuel' | 'trimestriel'>('mensuel')
  const [annee, setAnnee] = useState(anneeActuelle)
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3) + 1)
  const [data, setData] = useState<Apercu | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const anneesDisponibles = Array.from({ length: 5 }, (_, i) => anneeActuelle - i)

  const queryParams = periodeType === 'mensuel'
    ? `type=mensuel&annee=${annee}&mois=${mois}`
    : `type=trimestriel&annee=${annee}&trimestre=${trimestre}`

  useEffect(() => {
    let annule = false
    setLoading(true); setError(null)
    fetch(`/api/bd/rapport/apercu?${queryParams}`)
      .then(r => r.json())
      .then(json => {
        if (annule) return
        if (json.error) { setError(json.error); setData(null) }
        else setData(json)
      })
      .catch(() => { if (!annule) setError('Erreur de chargement.') })
      .finally(() => { if (!annule) setLoading(false) })
    return () => { annule = true }
  }, [queryParams])

  const soumises = data?.soumises ?? []
  const identifiees = data?.identifiees ?? []
  const nbAcceptees = soumises.filter(o => o.statut === 'accepte').length
  const nbRefusees = soumises.filter(o => o.statut === 'refuse').length
  const nbSansReponse = soumises.filter(o => o.statut === 'sans_reponse').length
  const nbEnAttente = soumises.filter(o => o.statut === 'soumis').length
  const resolues = nbAcceptees + nbRefusees
  const tauxSucces = resolues > 0 ? Math.round((nbAcceptees / resolues) * 100) : null
  const montantDemande = soumises.reduce((s, o) => s + (Number(o.montant_demande) || 0), 0)
  const montantObtenu = soumises.reduce((s, o) => s + (Number(o.montant_obtenu) || 0), 0)

  const repartition = (Object.keys(STATUT_LABELS) as OpportuniteStatut[])
    .map(s => ({ statut: s, value: soumises.filter(o => o.statut === s).length }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const repartitionMax = Math.max(1, ...repartition.map(r => r.value))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ color: '#111827', margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Rapport BD</h2>
          <p style={{ fontSize: 13.5, color: '#6b7280', margin: 0 }}>
            Rapport mensuel ou trimestriel standardisé du pipeline de financement, exportable en PDF.
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        background: 'white', border: '1px solid #eef0f2', borderRadius: 12, padding: 16, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', gap: 4, background: '#f9fafb', borderRadius: 8, padding: 4 }}>
          {(['mensuel', 'trimestriel'] as const).map(t => (
            <button key={t} onClick={() => setPeriodeType(t)} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: periodeType === t ? 'var(--abed-green)' : 'transparent',
              color: periodeType === t ? 'white' : '#374151',
            }}>
              {t === 'mensuel' ? 'Mensuel' : 'Trimestriel'}
            </button>
          ))}
        </div>

        {periodeType === 'mensuel' ? (
          <select value={mois} onChange={e => setMois(Number(e.target.value))} style={selectStyle}>
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        ) : (
          <select value={trimestre} onChange={e => setTrimestre(Number(e.target.value))} style={selectStyle}>
            {TRIMESTRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}

        <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={selectStyle}>
          {anneesDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <a
          href={`/api/bd/rapport/pdf?${queryParams}`}
          target="_blank"
          rel="noopener"
          className="btn"
          style={{ marginLeft: 'auto', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FileDown size={15} /> Télécharger le PDF
        </a>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Chargement de l&apos;aperçu…</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: '#991b1b' }}>{error}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
            <Tile label="Identifiées" value={identifiees.length} color="#475569" sub="durant la période" />
            <Tile label="Soumises" value={soumises.length} color="#1e40af" sub="durant la période" />
            <Tile label="Taux de succès" value={tauxSucces !== null ? `${tauxSucces}%` : '—'} color="#166534" sub={resolues > 0 ? `${nbAcceptees} sur ${resolues} réponses` : 'aucune réponse reçue'} />
            <Tile label="En attente" value={nbEnAttente} color="#b45309" sub="réponse du bailleur" />
            <Tile label="Montant demandé" value={fmtFcfa(montantDemande)} color="#6d28d9" />
            <Tile label="Montant obtenu" value={fmtFcfa(montantObtenu)} color="#0f766e" sub={montantDemande > 0 ? `${Math.round((montantObtenu / montantDemande) * 100)}% du demandé` : undefined} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1.6fr)', gap: 16, marginBottom: 28 }}>
            <div style={{ background: 'white', borderRadius: 14, padding: 22, border: '1px solid #eef0f2' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Répartition des soumissions</h3>
              {repartition.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af' }}>Aucune soumission durant la période.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {repartition.map(r => {
                    const pct = Math.round((r.value / repartitionMax) * 100)
                    return (
                      <div key={r.statut}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                          <span style={{ color: '#374151', fontWeight: 600 }}>{STATUT_LABELS[r.statut]}</span>
                          <strong style={{ color: '#111827' }}>{r.value}</strong>
                        </div>
                        <div style={{ height: 9, borderRadius: 5, background: '#f3f4f6', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: STATUT_COLORS[r.statut] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: 14, padding: 22, border: '1px solid #eef0f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TrendingUp size={16} color="#0f766e" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Résultats</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 4 }}>
                <ResultatMini label="Acceptées" value={nbAcceptees} color="#166534" />
                <ResultatMini label="Refusées" value={nbRefusees} color="#991b1b" />
                <ResultatMini label="Sans réponse" value={nbSansReponse} color="#78716c" />
              </div>
            </div>
          </div>

          <SectionTable
            titre={`Opportunités identifiées (${identifiees.length})`}
            icon={<FileText size={16} color="#1e40af" />}
            opportunites={identifiees}
            colonneDate="Identifiée le"
            date={o => fmtDate(o.date_identification)}
          />
          <SectionTable
            titre={`Opportunités soumises (${soumises.length})`}
            icon={<FileText size={16} color="#6d28d9" />}
            opportunites={soumises}
            colonneDate="Soumise le"
            date={o => fmtDate(o.date_soumission)}
            montants
          />
        </>
      )}
    </div>
  )
}

function ResultatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 8, background: color + '0d' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SectionTable({
  titre, icon, opportunites, colonneDate, date, montants,
}: {
  titre: string; icon: React.ReactNode; opportunites: Opportunite[]; colonneDate: string
  date: (o: Opportunite) => string; montants?: boolean
}) {
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #eef0f2', marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{titre}</h3>
      </div>
      {opportunites.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af', padding: 20 }}>Aucune opportunité.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Intitulé', 'Bailleur', 'Type', colonneDate, 'Responsable', 'Statut', ...(montants ? ['Demandé', 'Obtenu'] : [])].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opportunites.map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 14px', fontWeight: 600, maxWidth: 280 }}>
                    <Link href={`/bd/opportunites/${o.id}`} style={{ color: '#111827', textDecoration: 'none' }}>{o.titre}</Link>
                  </td>
                  <td style={{ padding: '9px 14px', color: '#6b7280' }}>{o.bailleur ?? '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{TYPE_OPPORTUNITE_LABELS[o.type_opportunite]}</td>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>{date(o)}</td>
                  <td style={{ padding: '9px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{o.responsable ? `${o.responsable.prenoms} ${o.responsable.nom}` : '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: STATUT_COLORS[o.statut], background: STATUT_COLORS[o.statut] + '15',
                      border: `1px solid ${STATUT_COLORS[o.statut]}40`, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap',
                    }}>
                      {STATUT_LABELS[o.statut]}
                    </span>
                  </td>
                  {montants && (
                    <>
                      <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{o.montant_demande ? o.montant_demande.toLocaleString('fr-FR') : '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{o.montant_obtenu ? o.montant_obtenu.toLocaleString('fr-FR') : '—'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: '#374151',
  border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer',
}
