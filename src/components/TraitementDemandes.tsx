'use client'
import { useEffect, useState } from 'react'
import { Clock, User, Users, CheckCircle2, type LucideIcon } from 'lucide-react'
import Pagination, { paginate } from '@/components/Pagination'
import { estAAF } from '@/lib/roles'

type Demande = {
  id: string; numero: string | null; demandeur_id: string; nom_complet: string; email_contact: string; departement: string
  objet: string; code_budgetaire: string; projet: string; nature_depense: string
  montant: number; mode_paiement: string; beneficiaire: string; reference_piece: string
  justification: string; urgence: string; date_souhaitee: string | null
  fichier_justificatif_url: string | null; status: string
  commentaire_aaf: string | null; commentaire_caf: string | null; commentaire_de: string | null
  created_at: string
  demandeur: { nom: string; prenoms: string } | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:       { label: 'En attente AAF',    color: '#92660b' },
  valide_aaf:   { label: 'En attente CAF',    color: '#1e40af' },
  valide_caf:   { label: 'En attente DE',     color: '#6d28d9' },
  autorise:     { label: '✓ Autorisé',        color: '#166534' },
  rejete_aaf:   { label: '✗ Rejeté (AAF)',    color: '#991b1b' },
  rejete_caf:   { label: '✗ Rejeté (CAF)',    color: '#991b1b' },
  refuse_caf:   { label: '✗ Refusé (CAF)',    color: '#991b1b' },
  refuse_de:    { label: '✗ Refusé (DE)',     color: '#991b1b' },
}

const URGENCE_COLOR: Record<string, string> = {
  urgente: '#991b1b', normale: '#92660b', peut_attendre: '#1e40af',
}

// Statuts définitifs : plus aucune action possible sur la demande.
const STATUTS_TERMINAUX = ['autorise', 'rejete_aaf', 'rejete_caf', 'refuse_caf', 'refuse_de']

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir : ' + (json.error ?? 'erreur'))
}

type Onglet = { key: string; icon: LucideIcon; label: string; desc: string; count: number; color?: string; items: Demande[]; actif: boolean }

export default function TraitementDemandes({ role, userId, hideMesDemandes }: { role: string; userId: string; hideMesDemandes?: boolean }) {
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/demandes-paiement')
    const json = await res.json()
    setDemandes(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function agir(id: string, action: string) {
    const commentaire = commentMap[id] ?? ''
    if (action !== 'valider' && action !== 'autoriser' && !commentaire.trim()) {
      alert('Un commentaire est obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/demandes-paiement/${id}/traiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  // Seuls AAF, CAF et DE ont une action réelle sur ce circuit (+ admin en secours
  // technique aux deux étapes). Brancher d'abord sur le statut plutôt que sur le
  // rôle : sinon "admin" — présent aux deux étapes — retournait toujours le
  // résultat de la première condition testée, quel que soit le statut réel.
  function canAct(d: Demande) {
    if (d.status === 'soumis') return estAAF(role) || role === 'admin'
    if (d.status === 'valide_aaf') return role === 'caf'
    if (d.status === 'valide_caf') return role === 'de' || role === 'admin'
    return false
  }

  // Mes propres demandes personnelles à part, quel que soit leur statut — y compris
  // celles qu'on pourrait théoriquement "traiter" soi-même (pas d'auto-validation affichée ici).
  const mesDemandes = demandes.filter(d => d.demandeur_id === userId)
  const autres = demandes.filter(d => d.demandeur_id !== userId)
  const aTraiter = autres.filter(canAct)
  const enCours = autres.filter(d => !canAct(d) && !STATUTS_TERMINAUX.includes(d.status))
  const cloturees = autres.filter(d => !canAct(d) && STATUTS_TERMINAUX.includes(d.status))

  // "Mes demandes" est masqué dans le menu AAF (/aaf/demandes-paiement) :
  // c'est une information personnelle, pas un traitement — elle ne vit plus
  // que dans "Mon espace" (/demandes).
  const onglets: Onglet[] = [
    { key: 'a_traiter', icon: Clock, label: 'À traiter', desc: 'Votre action requise',
      count: aTraiter.length, color: aTraiter.length > 0 ? '#b45309' : undefined, items: aTraiter, actif: true },
    ...(hideMesDemandes ? [] : [
      { key: 'mes_demandes', icon: User, label: 'Mes demandes', desc: 'Vos soumissions personnelles',
        count: mesDemandes.length, color: mesDemandes.length > 0 ? '#166534' : undefined, items: mesDemandes, actif: false },
    ]),
    { key: 'en_cours', icon: Users, label: 'En cours ailleurs', desc: "Chez d'autres traiteurs",
      count: enCours.length, color: enCours.length > 0 ? '#1e40af' : undefined, items: enCours, actif: false },
    { key: 'cloturees', icon: CheckCircle2, label: 'Clôturées', desc: 'Statut définitif',
      count: cloturees.length, color: cloturees.length > 0 ? '#6b7280' : undefined, items: cloturees, actif: false },
  ]

  if (loading) return <p>Chargement…</p>

  if (demandes.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'var(--abed-muted)' }}>Aucune demande de paiement.</p>
      </div>
    )
  }

  const currentKey = activeTab ?? (aTraiter.length > 0 ? 'a_traiter' : onglets.find(o => o.count > 0)?.key ?? 'a_traiter')
  const current = onglets.find(o => o.key === currentKey) ?? onglets[0]

  const renderDemande = (d: Demande, actif: boolean) => {
    const isOpen = expanded === d.id
    const st = STATUS_LABEL[d.status] ?? { label: d.status, color: '#374151' }
    return (
      <div key={d.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 8 }}
          onClick={() => setExpanded(isOpen ? null : d.id)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              {d.numero && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', fontFamily: 'monospace' }}>
                  {d.numero}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6,
                padding: '3px 10px', fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                👤 {d.nom_complet}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: URGENCE_COLOR[d.urgence] ?? '#374151',
                background: (URGENCE_COLOR[d.urgence] ?? '#374151') + '15', padding: '1px 6px', borderRadius: 999 }}>
                {d.urgence === 'urgente' ? '⚠️ Urgente' : d.urgence === 'peut_attendre' ? '🔵 Peut attendre' : '🔶 Normale'}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{d.objet}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
              <strong style={{ color: 'var(--abed-green)' }}>{Number(d.montant).toLocaleString('fr-FR')} FCFA</strong>
              {' '}— {d.departement} — {new Date(d.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: st.color + '22', color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
            <span style={{ fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {isOpen && (
          <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Département', d.departement], ['Code budgétaire', d.code_budgetaire],
                ['Projet', d.projet], ['Nature', d.nature_depense],
                ['Mode paiement', d.mode_paiement], ['Bénéficiaire', d.beneficiaire],
                ['Réf. pièce', d.reference_piece],
                ['Date souhaitée', d.date_souhaitee ? new Date(d.date_souhaitee).toLocaleDateString('fr-FR') : '—'],
              ].map(([k, v]) => (
                <div key={k}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--abed-muted)' }}>{k}</span><br />
                  <span style={{ fontSize: 13 }}>{v}</span></div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: 12 }}>Justification :</strong>
              <p style={{ fontSize: 13, marginTop: 4, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>{d.justification}</p>
            </div>
            {d.fichier_justificatif_url && (
              <button className="btn secondary" style={{ fontSize: 12, alignSelf: 'flex-start' }}
                onClick={() => openFile(d.fichier_justificatif_url!)}>
                📎 Voir pièce justificative
              </button>
            )}
            {(d.commentaire_aaf || d.commentaire_caf || d.commentaire_de) && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 10 }}>
                {d.commentaire_aaf && <p style={{ fontSize: 12 }}><strong>AAF :</strong> {d.commentaire_aaf}</p>}
                {d.commentaire_caf && <p style={{ fontSize: 12 }}><strong>CAF :</strong> {d.commentaire_caf}</p>}
                {d.commentaire_de && <p style={{ fontSize: 12 }}><strong>DE :</strong> {d.commentaire_de}</p>}
              </div>
            )}

            {actif && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet)</label>
                  <textarea className="input" rows={2} value={commentMap[d.id] ?? ''}
                    onChange={e => setCommentMap(m => ({ ...m, [d.id]: e.target.value }))}
                    placeholder="Motif de rejet ou observation…" />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {d.status === 'valide_caf' ? (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'autoriser')}>
                        ✓ Autoriser
                      </button>
                      <button className="btn danger" style={{ background: '#7f1d1d', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'refuser')}>
                        ✗ Refuser
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'valider')}>
                        ✓ Valider
                      </button>
                      <button className="btn danger" style={{ fontSize: 13 }}
                        disabled={submitting === d.id} onClick={() => agir(d.id, 'rejeter')}>
                        ✗ Rejeter
                      </button>
                      {role === 'caf' && (
                        <button className="btn danger" style={{ background: '#7f1d1d', fontSize: 13 }}
                          disabled={submitting === d.id} onClick={() => agir(d.id, 'refuser')}>
                          ⛔ Refuser
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Onglets sous forme de cartes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {onglets.map(o => {
          const active = currentKey === o.key
          return (
            <button
              key={o.key}
              onClick={() => { setActiveTab(o.key); setPage(1) }}
              style={{
                background: active ? 'var(--abed-green)' : 'white',
                border: active ? '2px solid var(--abed-green)' : '2px solid #e5e7eb',
                borderRadius: 14, padding: '14px 16px',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
                boxShadow: active ? '0 4px 14px rgba(6,95,70,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <o.icon size={22} color={active ? 'white' : (o.color ?? '#6b7280')} strokeWidth={1.75} />
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : (o.count > 0 ? '#fef3c7' : '#f3f4f6'),
                  color: active ? 'white' : (o.count > 0 ? '#92400e' : '#9ca3af'),
                  borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700,
                  border: active ? '1px solid rgba(255,255,255,0.3)' : (o.count > 0 ? '1px solid #fcd34d' : '1px solid #e5e7eb'),
                }}>
                  {o.count}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'white' : '#111827', marginBottom: 2 }}>
                {o.label}
              </div>
              <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}>
                {o.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--abed-border)', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8 }}>
          <current.icon size={16} color="var(--abed-green)" strokeWidth={2} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{current.label}</span>
          {current.count > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700, border: '1px solid #fcd34d' }}>
              {current.count}
            </span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          {current.items.length === 0 ? (
            <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucune demande dans cette catégorie.</p>
          ) : (
            <>
              {paginate(current.items, page).map(d => renderDemande(d, current.actif))}
              <Pagination page={page} total={current.items.length} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
