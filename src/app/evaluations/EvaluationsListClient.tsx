'use client'
import Link from 'next/link'
import { useState } from 'react'
import { ClipboardList, AlertCircle, CheckCircle2, ChevronRight, Star } from 'lucide-react'
import Pagination, { paginate } from '@/components/Pagination'

const PAGE_SIZE = 10

const STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:           { label: 'En attente',          color: '#92400e', bg: '#fffbeb' },
  evaluateur_complete:  { label: 'Évaluateur complété', color: '#1e40af', bg: '#eff6ff' },
  evalue_complete:      { label: 'À commenter',          color: '#6b21a8', bg: '#faf5ff' },
  responsable_complete: { label: 'Responsable signé',    color: '#92400e', bg: '#fffbeb' },
  cloture:              { label: 'Clôturé',              color: '#166534', bg: '#f0fdf4' },
}

type Decision = { decision?: string } | null
type Evaluation = {
  id: string
  statut: string
  declenchee_le: string | null
  score_moyen: number | null
  profile_id: string
  evaluateur_id: string
  responsable_id: string | null
  decision_caf: Decision
  decision_de: Decision
  profile: { nom: string; prenoms: string } | null
  contrat: { type_contrat: string; date_fin: string | null; poste: string | null } | null
}

type MonRole = 'evaluateur' | 'evalue' | 'responsable' | 'decideur_caf' | 'decideur_de' | null

// Une même personne peut cumuler plusieurs rôles sur une évaluation (p. ex.
// évaluateur et responsable de département) — on retient celui qui exige
// une action de sa part en priorité, à défaut le premier rôle détenu.
// decideur_caf/decideur_de : le CAF (resp. DE/DP) rend sa décision en
// Section X une fois le dossier au stade "responsable_complete" — ce rôle
// n'est pas lié à evaluateur_id/profile_id/responsable_id, il découle
// uniquement du rôle système de la personne connectée (myRole).
function monRole(e: Evaluation, myId: string, myRole: string): MonRole {
  const roles: MonRole[] = []
  if (e.evaluateur_id === myId) roles.push('evaluateur')
  if (e.responsable_id === myId) roles.push('responsable')
  if (e.profile_id === myId) roles.push('evalue')
  if (myRole === 'caf' && ['responsable_complete', 'cloture'].includes(e.statut)) roles.push('decideur_caf')
  if (['de', 'dp'].includes(myRole) && ['responsable_complete', 'cloture'].includes(e.statut)) roles.push('decideur_de')
  const enAttente = roles.find(r => actionRequise(e, r))
  return enAttente ?? roles[0] ?? null
}

// Action requise de ma part, selon mon rôle sur cette évaluation et son
// étape actuelle dans le circuit évaluateur → évalué → responsable → décideurs.
function actionRequise(e: Evaluation, role: MonRole): boolean {
  if (role === 'evaluateur') return e.statut === 'en_attente'
  if (role === 'evalue') return e.statut === 'evaluateur_complete'
  if (role === 'responsable') return e.statut === 'evalue_complete'
  if (role === 'decideur_caf') return e.statut === 'responsable_complete' && !e.decision_caf?.decision
  if (role === 'decideur_de') return e.statut === 'responsable_complete' && !e.decision_de?.decision
  return false
}

function EvalCard({ e, myId, myRole, urgent }: { e: Evaluation; myId: string; myRole: string; urgent?: boolean }) {
  const s = STATUTS[e.statut] ?? { label: e.statut, color: '#6b7280', bg: '#f3f4f6' }
  const role = monRole(e, myId, myRole)
  const titre = ['evaluateur', 'responsable', 'decideur_caf', 'decideur_de'].includes(role ?? '')
    ? `${e.profile?.prenoms ?? ''} ${e.profile?.nom ?? ''}`.trim() || 'Personnel'
    : (e.contrat?.poste ?? 'Poste N/A')
  // Pour les décideurs, le libellé dépend de si leur décision est déjà
  // rendue (dossier consultable après coup) ou encore attendue.
  const decisionDejaRendue = role === 'decideur_caf' ? !!e.decision_caf?.decision
    : role === 'decideur_de' ? !!e.decision_de?.decision : false
  const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    evaluateur: { label: 'Vous êtes l’évaluateur', bg: '#ede9fe', color: '#6d28d9' },
    responsable: { label: 'Vous êtes le/la responsable', bg: '#fef3c7', color: '#92400e' },
    evalue: { label: 'Votre évaluation', bg: '#dbeafe', color: '#1e40af' },
    decideur_caf: decisionDejaRendue
      ? { label: 'Décision CAF donnée', bg: '#f0fdf4', color: '#166534' }
      : { label: 'Décision CAF requise', bg: '#fee2e2', color: '#b91c1c' },
    decideur_de: decisionDejaRendue
      ? { label: 'Décision DE donnée', bg: '#f0fdf4', color: '#166534' }
      : { label: 'Décision DE requise', bg: '#fee2e2', color: '#b91c1c' },
  }
  const roleBadge = ROLE_BADGE[role ?? 'evalue'] ?? ROLE_BADGE.evalue

  return (
    <Link href={`/evaluations/${e.id}`} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      background: 'white', textDecoration: 'none', color: 'inherit',
      border: `1px solid ${urgent ? '#fde68a' : 'var(--abed-border)'}`,
      borderLeft: urgent ? '4px solid #d97706' : '1px solid var(--abed-border)',
      borderRadius: 10, padding: '14px 18px',
      transition: 'box-shadow .15s, border-color .15s',
    }}
      onMouseEnter={e2 => { (e2.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,.07)' }}
      onMouseLeave={e2 => { (e2.currentTarget as HTMLElement).style.boxShadow = 'none' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{titre}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em',
            padding: '2px 8px', borderRadius: 20,
            background: roleBadge.bg, color: roleBadge.color,
          }}>
            {roleBadge.label}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--abed-muted)', marginTop: 5 }}>
          {e.contrat?.type_contrat ?? ''}{e.contrat?.poste && (role === 'evaluateur' || role === 'responsable') ? ` — ${e.contrat.poste}` : ''}
          {e.contrat?.date_fin && <> · Fin de contrat : {e.contrat.date_fin}</>}
          {e.declenchee_le && <> · Déclenchée le {new Date(e.declenchee_le).toLocaleDateString('fr-FR')}</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {e.score_moyen != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: 'var(--abed-green)', fontSize: 14 }}>
            <Star size={14} fill="var(--abed-green)" strokeWidth={0} /> {Number(e.score_moyen).toFixed(1)}/5
          </span>
        )}
        <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {s.label}
        </span>
        <ChevronRight size={18} color="#9ca3af" />
      </div>
    </Link>
  )
}

export default function EvaluationsListClient({ evaluations, myId, myRole }: { evaluations: Evaluation[]; myId: string; myRole: string }) {
  const [page, setPage] = useState(1)

  const aTraiter = evaluations.filter(e => actionRequise(e, monRole(e, myId, myRole)))
  const enCours = evaluations.filter(e => e.statut !== 'cloture')
  const paged = paginate(evaluations, page, PAGE_SIZE)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <ClipboardList size={24} color="var(--abed-green)" />
        <h2 style={{ margin: 0, color: 'var(--abed-green)' }}>Mes évaluations</h2>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--abed-muted)', margin: '0 0 24px' }}>
        Vos évaluations de performance — en tant qu'évaluateur ou en tant que personne évaluée.
      </p>

      {evaluations.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '56px 24px', color: 'var(--abed-muted)',
          background: 'white', border: '1px dashed var(--abed-border)', borderRadius: 12,
        }}>
          <ClipboardList size={30} color="#d1d5db" style={{ marginBottom: 10 }} />
          <div>Aucune évaluation pour le moment.</div>
        </div>
      ) : (
        <>
          {/* Résumé */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '14px 20px', flex: '1 1 160px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{evaluations.length}</div>
              <div style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>Au total</div>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '14px 20px', flex: '1 1 160px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{enCours.length}</div>
              <div style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>En cours</div>
            </div>
            <div style={{
              background: aTraiter.length > 0 ? '#fffbeb' : 'white',
              border: `1px solid ${aTraiter.length > 0 ? '#fde68a' : 'var(--abed-border)'}`,
              borderRadius: 10, padding: '14px 20px', flex: '1 1 160px',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: aTraiter.length > 0 ? '#b45309' : '#111827' }}>{aTraiter.length}</div>
              <div style={{ fontSize: 12.5, color: aTraiter.length > 0 ? '#92400e' : 'var(--abed-muted)' }}>À traiter par vous</div>
            </div>
          </div>

          {/* À traiter */}
          {aTraiter.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertCircle size={17} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: 15, color: '#92400e' }}>À traiter ({aTraiter.length})</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {aTraiter.map(e => <EvalCard key={e.id} e={e} myId={myId} myRole={myRole} urgent />)}
              </div>
            </div>
          )}

          {/* Toutes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircle2 size={16} color="var(--abed-muted)" />
            <h3 style={{ margin: 0, fontSize: 15, color: '#374151' }}>Toutes mes évaluations</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paged.map(e => <EvalCard key={e.id} e={e} myId={myId} myRole={myRole} />)}
          </div>
          <Pagination page={page} total={evaluations.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </>
  )
}
