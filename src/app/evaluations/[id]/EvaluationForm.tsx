'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Profile = { id: string; nom: string; prenoms: string; email: string; role?: string }
type Contrat = { id: string; type_contrat: string; date_debut: string; date_fin: string | null; poste: string | null }
type Evaluation = {
  id: string
  statut: string
  poste: string | null
  direction: string | null
  superieur_hierarchique: string | null
  superieur_fonctionnel: string | null
  responsable_departement: string | null
  nom_evaluateur: string | null
  description_taches: string | null
  grille_notes: Record<string, number>
  score_moyen: number | null
  qualites: string | null
  points_amelioration: string | null
  actions_exceptionnelles: string | null
  evaluation_generale: string | null
  commentaire_evaluateur: string | null
  signature_evaluateur: string | null
  date_evaluateur: string | null
  commentaire_evalue: string | null
  signature_evalue: string | null
  date_evalue: string | null
  avis_responsable: string | null
  commentaire_responsable: string | null
  signature_responsable: string | null
  date_responsable: string | null
  decision_evaluateur: Record<string, string>
  decision_rh: Record<string, string>
  decision_de: Record<string, string>
  profile: Profile | null
  evaluateur: Profile | null
  contrat: Contrat | null
  declenchee_le: string
}

type Props = {
  evaluation: Evaluation
  myId: string
  myRole: string
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente (évaluateur)',
  evaluateur_complete: 'Commentaires évalué requis',
  evalue_complete: 'Signature responsable requise',
  responsable_complete: 'Décision finale requise',
  cloture: 'Clôturé',
}

const SCORE_LABELS: Record<number, string> = {
  1: '1 – Ne répond pas du tout',
  2: '2 – Répond partiellement',
  3: '3 – Répond globalement',
  4: '4 – Répond complètement',
  5: '5 – Dépasse largement',
}

const GRILLE: { cat: string; items: { key: string; label: string }[] }[] = [
  {
    cat: 'I. Connaissances techniques et professionnelles',
    items: [
      { key: 'c1_1', label: 'Maîtrise des connaissances nécessaires à l\'exercice de ses fonctions' },
      { key: 'c1_2', label: 'Capacité à mettre en pratique les connaissances liées à son poste' },
      { key: 'c1_3', label: 'Aptitude à transférer les compétences techniques' },
      { key: 'c1_4', label: 'Intérêt pour le développement et la mise à jour des connaissances' },
    ],
  },
  {
    cat: 'II. Capacités personnelles',
    items: [
      { key: 'c2_1', label: 'Sens des responsabilités et prise d\'initiative' },
      { key: 'c2_2', label: 'Capacité à prendre des décisions appropriées' },
      { key: 'c2_3', label: 'Aptitude à gérer le stress et les situations difficiles' },
      { key: 'c2_4', label: 'Créativité et innovation dans la résolution des problèmes' },
    ],
  },
  {
    cat: 'III. Qualités relationnelles et comportementales',
    items: [
      { key: 'c3_1', label: 'Qualité des relations interpersonnelles et travail en équipe' },
      { key: 'c3_2', label: 'Communication orale et écrite (clarté, pertinence)' },
      { key: 'c3_3', label: 'Respect des collègues, partenaires et bénéficiaires' },
      { key: 'c3_4', label: 'Adhésion aux valeurs et culture organisationnelle de l\'ABED' },
    ],
  },
  {
    cat: 'IV. Productivité et résultats',
    items: [
      { key: 'c4_1', label: 'Atteinte des objectifs fixés dans les délais impartis' },
      { key: 'c4_2', label: 'Qualité du travail fourni (précision, rigueur)' },
      { key: 'c4_3', label: 'Efficience dans l\'utilisation des ressources disponibles' },
      { key: 'c4_4', label: 'Aptitude à planifier, organiser et prioriser les tâches' },
    ],
  },
  {
    cat: 'V. Comportement et discipline',
    items: [
      { key: 'c5_1', label: 'Assiduité et ponctualité' },
      { key: 'c5_2', label: 'Respect du règlement intérieur et des procédures' },
      { key: 'c5_3', label: 'Engagement et motivation dans le travail' },
      { key: 'c5_4', label: 'Intégrité et éthique professionnelle' },
    ],
  },
]

const EVALUATION_GENERALE_OPTIONS = [
  'Excellent(e) — Dépasse largement les attentes',
  'Très bien — Dépasse les attentes',
  'Bien — Répond aux attentes',
  'Assez bien — Répond partiellement aux attentes',
  'Insuffisant(e) — Ne répond pas aux attentes',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        background: '#2d6a4f', color: 'white', padding: '8px 16px',
        borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
      }}>
        {title}
      </div>
      <div style={{ border: '1px solid var(--abed-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '20px 20px' }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--abed-border)',
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 80, resize: 'vertical',
}

const readonlyStyle: React.CSSProperties = {
  ...inputStyle, background: '#f9fafb', color: '#374151',
}

export default function EvaluationForm({ evaluation: ev, myId, myRole }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Determine what this user can edit
  const isEvaluateur = ev.evaluateur_id === myId || ['rh', 'admin'].includes(myRole)
  const isEvalue = ev.profile_id === myId
  const isRH = ['rh', 'admin', 'de'].includes(myRole)

  const canEditSec1to6 = ev.statut === 'en_attente' && isEvaluateur
  const canEditSec7 = ev.statut === 'evaluateur_complete' && isEvalue
  const canEditSec8 = ev.statut === 'evalue_complete' && (isEvaluateur || isRH)
  const canEditSec10 = ev.statut === 'responsable_complete' && isRH
  const canEdit = canEditSec1to6 || canEditSec7 || canEditSec8 || canEditSec10

  // Form state — Section I
  const [poste, setPoste] = useState(ev.poste ?? '')
  const [direction, setDirection] = useState(ev.direction ?? '')
  const [supHier, setSupHier] = useState(ev.superieur_hierarchique ?? '')
  const [supFonc, setSupFonc] = useState(ev.superieur_fonctionnel ?? '')
  const [respDept, setRespDept] = useState(ev.responsable_departement ?? '')
  const [nomEval, setNomEval] = useState(ev.nom_evaluateur ?? '')
  const [descTaches, setDescTaches] = useState(ev.description_taches ?? '')

  // Section II — grille
  const [notes, setNotes] = useState<Record<string, number>>(ev.grille_notes ?? {})

  // Section III
  const [qualites, setQualites] = useState(ev.qualites ?? '')
  const [pointsAmel, setPointsAmel] = useState(ev.points_amelioration ?? '')

  // Section IV
  const [actionsExcep, setActionsExcep] = useState(ev.actions_exceptionnelles ?? '')

  // Section V
  const [evalGen, setEvalGen] = useState(ev.evaluation_generale ?? '')

  // Section VI
  const [commentEval, setCommentEval] = useState(ev.commentaire_evaluateur ?? '')
  const [sigEval, setSigEval] = useState(ev.signature_evaluateur ?? '')
  const [dateEval, setDateEval] = useState(ev.date_evaluateur ?? '')

  // Section VII
  const [commentEvalue, setCommentEvalue] = useState(ev.commentaire_evalue ?? '')
  const [sigEvalue, setSigEvalue] = useState(ev.signature_evalue ?? '')
  const [dateEvalue, setDateEvalue] = useState(ev.date_evalue ?? '')

  // Section VIII
  const [avisResp, setAvisResp] = useState(ev.avis_responsable ?? '')
  const [commentResp, setCommentResp] = useState(ev.commentaire_responsable ?? '')
  const [sigResp, setSigResp] = useState(ev.signature_responsable ?? '')
  const [dateResp, setDateResp] = useState(ev.date_responsable ?? '')

  // Section X
  const [decEval, setDecEval] = useState<Record<string, string>>(ev.decision_evaluateur ?? {})
  const [decRH, setDecRH] = useState<Record<string, string>>(ev.decision_rh ?? {})
  const [decDE, setDecDE] = useState<Record<string, string>>(ev.decision_de ?? {})

  function buildPayload(soumettre = false) {
    const base: Record<string, unknown> = { soumettre }
    if (canEditSec1to6) {
      Object.assign(base, {
        poste, direction,
        superieur_hierarchique: supHier,
        superieur_fonctionnel: supFonc,
        responsable_departement: respDept,
        nom_evaluateur: nomEval,
        description_taches: descTaches,
        grille_notes: notes,
        qualites, points_amelioration: pointsAmel,
        actions_exceptionnelles: actionsExcep,
        evaluation_generale: evalGen,
        commentaire_evaluateur: commentEval,
        signature_evaluateur: sigEval,
        date_evaluateur: dateEval || null,
      })
    }
    if (canEditSec7) {
      Object.assign(base, {
        commentaire_evalue: commentEvalue,
        signature_evalue: sigEvalue,
        date_evalue: dateEvalue || null,
      })
    }
    if (canEditSec8) {
      Object.assign(base, {
        avis_responsable: avisResp,
        commentaire_responsable: commentResp,
        signature_responsable: sigResp,
        date_responsable: dateResp || null,
      })
    }
    if (canEditSec10) {
      Object.assign(base, {
        decision_evaluateur: decEval,
        decision_rh: decRH,
        decision_de: decDE,
      })
    }
    return base
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/evaluations/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(false)),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error ?? 'Erreur' }); return }
      setMsg({ type: 'ok', text: 'Enregistré.' })
    } catch { setMsg({ type: 'err', text: 'Erreur réseau' }) }
    finally { setSaving(false) }
  }

  async function handleSubmit() {
    setSubmitting(true); setMsg(null)
    try {
      const res = await fetch(`/api/evaluations/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true)),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'err', text: data.error ?? 'Erreur' }); return }
      setMsg({ type: 'ok', text: 'Soumis avec succès.' })
      setTimeout(() => router.refresh(), 1000)
    } catch { setMsg({ type: 'err', text: 'Erreur réseau' }) }
    finally { setSubmitting(false) }
  }

  const avgScore = () => {
    const vals = Object.values(notes).filter(v => v > 0)
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
  }

  const statutColor = ev.statut === 'cloture' ? '#166534' : ev.statut === 'en_attente' ? '#92400e' : '#1e40af'
  const statutBg = ev.statut === 'cloture' ? '#f0fdf4' : ev.statut === 'en_attente' ? '#fffbeb' : '#eff6ff'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/evaluations" style={{ fontSize: 13, color: 'var(--abed-muted)', textDecoration: 'none' }}>← Retour</Link>
        <h2 style={{ margin: 0, color: 'var(--abed-green)', flex: 1 }}>Fiche d&apos;évaluation</h2>
        <span style={{
          background: statutBg, color: statutColor,
          borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 700,
        }}>
          {STATUT_LABELS[ev.statut] ?? ev.statut}
        </span>
      </div>

      {msg && (
        <div style={{
          background: msg.type === 'ok' ? '#f0fdf4' : '#fdf0f0',
          border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#f5b7b1'}`,
          color: msg.type === 'ok' ? '#166534' : '#c0392b',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14,
        }}>
          {msg.text}
        </div>
      )}

      {/* Section I — Identification */}
      <Section title="Section I — Identification de l'évalué(e)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nom & Prénoms">
            <input value={`${ev.profile?.prenoms ?? ''} ${ev.profile?.nom ?? ''}`} readOnly style={readonlyStyle} />
          </Field>
          <Field label="Poste occupé">
            <input value={poste} onChange={e => setPoste(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Direction / Service">
            <input value={direction} onChange={e => setDirection(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Supérieur hiérarchique">
            <input value={supHier} onChange={e => setSupHier(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Supérieur fonctionnel">
            <input value={supFonc} onChange={e => setSupFonc(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Responsable département">
            <input value={respDept} onChange={e => setRespDept(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Nom de l'évaluateur">
            <input value={nomEval} onChange={e => setNomEval(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
          <Field label="Type de contrat">
            <input value={ev.contrat?.type_contrat ?? ''} readOnly style={readonlyStyle} />
          </Field>
          <Field label="Date début contrat">
            <input value={ev.contrat?.date_debut ?? ''} readOnly style={readonlyStyle} />
          </Field>
          <Field label="Date fin contrat">
            <input value={ev.contrat?.date_fin ?? ''} readOnly style={readonlyStyle} />
          </Field>
        </div>
        <Field label="Description des tâches principales">
          <textarea value={descTaches} onChange={e => setDescTaches(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} />
        </Field>
      </Section>

      {/* Section II — Grille de compétences */}
      <Section title="Section II — Grille d'évaluation des compétences (1 à 5)">
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: 0 }}>
          Échelle : 1 = Ne répond pas du tout · 2 = Répond partiellement · 3 = Répond globalement · 4 = Répond complètement · 5 = Dépasse largement
        </p>
        {GRILLE.map(cat => (
          <div key={cat.cat} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#2d6a4f', marginBottom: 10, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
              {cat.cat}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cat.items.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#374151', minWidth: 200 }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        disabled={!canEditSec1to6}
                        onClick={() => canEditSec1to6 && setNotes(prev => ({ ...prev, [item.key]: n }))}
                        title={SCORE_LABELS[n]}
                        style={{
                          width: 36, height: 36, borderRadius: 6, border: '1px solid',
                          fontSize: 14, fontWeight: 700, cursor: canEditSec1to6 ? 'pointer' : 'default',
                          borderColor: notes[item.key] === n ? 'var(--abed-green)' : '#d1d5db',
                          background: notes[item.key] === n ? 'var(--abed-green)' : 'white',
                          color: notes[item.key] === n ? 'white' : '#374151',
                          transition: 'all .1s',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {notes[item.key] > 0 && (
                    <span style={{ fontSize: 12, color: '#6b7280', minWidth: 180 }}>{SCORE_LABELS[notes[item.key]]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {avgScore() && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>Score moyen :</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--abed-green)' }}>{avgScore()}/5</span>
          </div>
        )}
      </Section>

      {/* Section III — Performances */}
      <Section title="Section III — Appréciation des performances">
        <Field label="Principales qualités et points forts">
          <textarea value={qualites} onChange={e => setQualites(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Décrivez les qualités observées..." />
        </Field>
        <Field label="Points à améliorer / axes de développement">
          <textarea value={pointsAmel} onChange={e => setPointsAmel(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Décrivez les axes d'amélioration..." />
        </Field>
      </Section>

      {/* Section IV — Actions exceptionnelles */}
      <Section title="Section IV — Actions / Réalisations exceptionnelles">
        <Field label="Décrivez toute action ou réalisation exceptionnelle au cours de la période">
          <textarea value={actionsExcep} onChange={e => setActionsExcep(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Actions ou réalisations remarquables..." />
        </Field>
      </Section>

      {/* Section V — Évaluation générale */}
      <Section title="Section V — Évaluation générale">
        <Field label="Appréciation globale de l'évalué(e)">
          {EVALUATION_GENERALE_OPTIONS.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: canEditSec1to6 ? 'pointer' : 'default', fontSize: 14 }}>
              <input
                type="radio"
                name="eval_generale"
                value={opt}
                checked={evalGen === opt}
                onChange={() => canEditSec1to6 && setEvalGen(opt)}
                disabled={!canEditSec1to6}
                style={{ accentColor: 'var(--abed-green)', width: 16, height: 16 }}
              />
              {opt}
            </label>
          ))}
        </Field>
      </Section>

      {/* Section VI — Commentaires évaluateur */}
      <Section title="Section VI — Commentaires et signature de l'évaluateur">
        <Field label="Commentaires de l'évaluateur">
          <textarea value={commentEval} onChange={e => setCommentEval(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Commentaires libres de l'évaluateur..." />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Nom & signature de l'évaluateur">
            <input value={sigEval} onChange={e => setSigEval(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} placeholder="Nom complet" />
          </Field>
          <Field label="Date">
            <input type="date" value={dateEval} onChange={e => setDateEval(e.target.value)} readOnly={!canEditSec1to6} style={canEditSec1to6 ? inputStyle : readonlyStyle} />
          </Field>
        </div>
      </Section>

      {/* Section VII — Commentaires évalué */}
      <Section title="Section VII — Commentaires de l'évalué(e)">
        {ev.statut === 'en_attente' ? (
          <p style={{ color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>
            Cette section sera disponible une fois que l&apos;évaluateur aura complété la fiche.
          </p>
        ) : (
          <>
            <Field label="Commentaires de l'évalué(e) sur son évaluation">
              <textarea value={commentEvalue} onChange={e => setCommentEvalue(e.target.value)} readOnly={!canEditSec7} style={canEditSec7 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Vos commentaires sur cette évaluation..." />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Nom & signature de l'évalué(e)">
                <input value={sigEvalue} onChange={e => setSigEvalue(e.target.value)} readOnly={!canEditSec7} style={canEditSec7 ? inputStyle : readonlyStyle} placeholder="Nom complet" />
              </Field>
              <Field label="Date">
                <input type="date" value={dateEvalue} onChange={e => setDateEvalue(e.target.value)} readOnly={!canEditSec7} style={canEditSec7 ? inputStyle : readonlyStyle} />
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* Section VIII — Avis responsable */}
      <Section title="Section VIII — Avis du responsable de département">
        {['en_attente', 'evaluateur_complete'].includes(ev.statut) ? (
          <p style={{ color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>
            Cette section sera disponible après la signature de l&apos;évalué(e).
          </p>
        ) : (
          <>
            <Field label="Avis du responsable">
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {['Poursuivre la collaboration', 'Ne pas poursuivre la collaboration'].map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: canEditSec8 ? 'pointer' : 'default' }}>
                    <input
                      type="radio"
                      name="avis_resp"
                      value={opt}
                      checked={avisResp === opt}
                      onChange={() => canEditSec8 && setAvisResp(opt)}
                      disabled={!canEditSec8}
                      style={{ accentColor: 'var(--abed-green)' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Commentaires du responsable de département">
              <textarea value={commentResp} onChange={e => setCommentResp(e.target.value)} readOnly={!canEditSec8} style={canEditSec8 ? textareaStyle : { ...textareaStyle, background: '#f9fafb' }} placeholder="Commentaires du responsable..." />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Nom & signature responsable">
                <input value={sigResp} onChange={e => setSigResp(e.target.value)} readOnly={!canEditSec8} style={canEditSec8 ? inputStyle : readonlyStyle} placeholder="Nom complet" />
              </Field>
              <Field label="Date">
                <input type="date" value={dateResp} onChange={e => setDateResp(e.target.value)} readOnly={!canEditSec8} style={canEditSec8 ? inputStyle : readonlyStyle} />
              </Field>
            </div>
          </>
        )}
      </Section>

      {/* Section X — Décisions finales */}
      <Section title="Section X — Décisions finales">
        {ev.statut !== 'responsable_complete' && ev.statut !== 'cloture' ? (
          <p style={{ color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>
            Cette section sera disponible une fois l&apos;avis du responsable soumis.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {[
              { label: 'Décision de l\'évaluateur', key: 'eval', state: decEval, setter: setDecEval, editable: canEditSec10 },
              { label: 'Décision des Ressources Humaines', key: 'rh', state: decRH, setter: setDecRH, editable: canEditSec10 },
              { label: 'Décision de la Direction Exécutive (DE)', key: 'de', state: decDE, setter: setDecDE, editable: canEditSec10 },
            ].map(({ label, key, state, setter, editable }) => (
              <div key={key}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {['Renouveler le contrat', 'Ne pas renouveler le contrat', 'Proposer une promotion'].map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: editable ? 'pointer' : 'default' }}>
                      <input
                        type="radio"
                        name={`decision_${key}`}
                        value={opt}
                        checked={state.decision === opt}
                        onChange={() => editable && setter({ decision: opt })}
                        disabled={!editable}
                        style={{ accentColor: 'var(--abed-green)' }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8, paddingBottom: 40 }}>
          <button
            onClick={handleSave}
            disabled={saving || submitting}
            style={{
              padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'white', border: '1px solid var(--abed-border)', color: '#374151',
              cursor: 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Enregistrement...' : '💾 Enregistrer (brouillon)'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || submitting}
            style={{
              padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: 'var(--abed-green)', color: 'white', border: 'none',
              cursor: 'pointer', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Soumission...' : '✅ Valider et soumettre'}
          </button>
        </div>
      )}

      {ev.statut === 'cloture' && (
        <div style={{ textAlign: 'center', padding: '24px', background: '#f0fdf4', borderRadius: 10, marginTop: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>✅ Évaluation clôturée</span>
          {ev.score_moyen && (
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--abed-green)', marginTop: 8 }}>
              Score final : {Number(ev.score_moyen).toFixed(2)}/5
            </div>
          )}
        </div>
      )}
    </div>
  )
}
