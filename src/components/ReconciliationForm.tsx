'use client'
import { useState } from 'react'
import { Award } from 'lucide-react'
import { UssdDon } from '@/components/DonAbedHeritage'
import { NOM_CLUB, montantDon } from '@/lib/dons'

type Ligne = { libelle: string; quantite: number; pu: number; montant: number }
type Rapport = { objectifs: string; activites: string; resultats: string; difficultes: string; suite: string }
type ModeFinancement = 'credit' | 'avance' | 'totalite_avant'

const RAPPORT_FIELDS: [keyof Rapport, string][] = [
  ['objectifs',   'Objectifs de la mission *'],
  ['activites',   'Activités menées *'],
  ['resultats',   'Résultats obtenus *'],
  ['difficultes', 'Difficultés rencontrées *'],
  ['suite',       'Suite à donner *'],
]

const MODE_OPTIONS: { value: ModeFinancement; label: string; desc: string }[] = [
  { value: 'credit', label: 'À crédit', desc: 'Mission effectuée à crédit — aucun paiement reçu avant ou pendant.' },
  { value: 'avance', label: 'Sur avance', desc: 'Une avance partielle a été reçue avant le départ.' },
  { value: 'totalite_avant', label: 'Totalité avant départ', desc: 'La totalité du budget a été reçue avant le départ — clôture automatique.' },
]

export default function ReconciliationForm({
  missionId,
  aChargePartenaire,
  commentaireRejet,
}: {
  missionId: string
  aChargePartenaire: boolean
  commentaireRejet?: string | null
}) {
  const [lignes, setLignes] = useState<Ligne[]>([{ libelle: '', quantite: 1, pu: 0, montant: 0 }])
  const [montantRecu, setMontantRecu] = useState(0)
  const [rapport, setRapport] = useState<Rapport>({ objectifs: '', activites: '', resultats: '', difficultes: '', suite: '' })
  const [modeFinancement, setModeFinancement] = useState<ModeFinancement | ''>('')
  const [pieces, setPieces] = useState<File[]>([])
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'warn'>('ok')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)
  const [retryingEmail, setRetryingEmail] = useState(false)
  const [donActif, setDonActif] = useState(false)
  const [donPourcentage, setDonPourcentage] = useState(10)
  const [donCapture, setDonCapture] = useState<File | null>(null)

  const totalDepenses = lignes.reduce((s, l) => s + (l.montant || 0), 0)

  const abedDoit = !aChargePartenaire
    ? modeFinancement === 'totalite_avant'
      ? 0
      : modeFinancement === 'avance'
        ? Math.max(0, totalDepenses - montantRecu)
        : totalDepenses
    : 0

  // Base du don ABED Héritage : montant reçu du partenaire, ou montant dû
  // par ABED (crédit/avance) auquel le missionnaire renonce en partie.
  const baseDon = aChargePartenaire ? montantRecu : (modeFinancement === 'credit' || modeFinancement === 'avance') ? abedDoit : 0
  const donPossible = baseDon > 0
  const montantDuDon = donActif && donPossible ? montantDon(baseDon, donPourcentage) : 0

  function updateLigne(i: number, patch: Partial<Ligne>) {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, ...patch }
      next.montant = (next.quantite || 0) * (next.pu || 0)
      return next
    }))
  }

  function validate(): string | null {
    for (const [k, lbl] of RAPPORT_FIELDS) {
      if (!rapport[k].trim()) return `Le champ "${lbl.replace(' *', '')}" est obligatoire.`
    }
    if (lignes.every(l => !l.libelle.trim())) return 'Saisissez au moins une ligne dans le point financier.'
    if (aChargePartenaire && montantRecu <= 0) return 'Saisissez le montant reçu du partenaire.'
    if (!aChargePartenaire && !modeFinancement) return 'Sélectionnez le mode de financement de la mission.'
    if (!aChargePartenaire && (modeFinancement === 'avance' || modeFinancement === 'totalite_avant') && montantRecu <= 0) {
      return 'Saisissez le montant reçu d\'ABED avant le départ.'
    }
    if (donActif && donPossible) {
      if (!(donPourcentage > 0 && donPourcentage <= 100)) return 'Le pourcentage du don doit être compris entre 1 et 100.'
      if (aChargePartenaire && !donCapture) return 'Joignez la capture du paiement MoMo de votre don.'
    }
    return null
  }

  async function submit() {
    const err = validate()
    if (err) { setMsg(err); setMsgType('err'); return }
    setLoading(true); setMsg(''); setEmailFailed(false)

    const piecesJointes: { path: string; nom: string }[] = []
    for (const file of pieces) {
      const fd = new FormData(); fd.append('file', file)
      const up = await fetch(`/api/missions/${missionId}/reconcile/upload`, { method: 'POST', body: fd })
      const upj = await up.json()
      if (!up.ok) {
        setLoading(false)
        setMsg(`Erreur pièce jointe "${file.name}" : ${upj.error ?? 'inconnue'}`)
        setMsgType('err')
        return
      }
      piecesJointes.push({ path: upj.path, nom: upj.nom })
    }

    let don: { pourcentage: number; capture_path?: string } | undefined
    if (donActif && donPossible) {
      don = { pourcentage: donPourcentage }
      if (aChargePartenaire && donCapture) {
        const fd = new FormData(); fd.append('file', donCapture)
        const up = await fetch(`/api/missions/${missionId}/reconcile/upload`, { method: 'POST', body: fd })
        const upj = await up.json()
        if (!up.ok) {
          setLoading(false)
          setMsg(`Erreur capture du don : ${upj.error ?? 'inconnue'}`)
          setMsgType('err')
          return
        }
        don.capture_path = upj.path
      }
    }

    const res = await fetch(`/api/missions/${missionId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        point_financier: lignes,
        montant_recu: montantRecu,
        rapport,
        mode_financement: aChargePartenaire ? null : modeFinancement,
        pieces_jointes: piecesJointes,
        don,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMsg('Erreur : ' + (data.error ?? 'inconnue'))
      setMsgType('err')
      return
    }
    setSubmitted(true)
    setMsg((data.message ?? 'Réconciliation enregistrée.') + (don ? ` Merci pour votre don à ${NOM_CLUB} !` : ''))
    setMsgType(data.status === 'reconciliation_aaf' ? 'warn' : 'ok')
    if (data.email_sent === false) {
      setEmailFailed(true)
    }
  }

  async function retryEmail() {
    setRetryingEmail(true)
    const res = await fetch(`/api/missions/${missionId}/retry-email`, { method: 'POST' })
    const data = await res.json()
    setRetryingEmail(false)
    if (!res.ok) {
      setMsg('Email non envoyé : ' + (data.error ?? 'erreur inconnue') + ' — réessayez plus tard.')
      setMsgType('err')
    } else {
      setEmailFailed(false)
      setMsg('Email envoyé avec succès aux gestionnaires (DE, CAF, AAF).')
      setMsgType('ok')
    }
  }

  const showMontantRecu = aChargePartenaire || modeFinancement === 'avance' || modeFinancement === 'totalite_avant'

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {commentaireRejet && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', borderRadius: 8, padding: '12px 16px' }}>
          <strong style={{ color: '#991b1b', fontSize: 14 }}>Réconciliation rejetée</strong>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7f1d1d' }}>Commentaire : {commentaireRejet}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#991b1b' }}>Corrigez les informations ci-dessous et resoumettez.</p>
        </div>
      )}

      {!submitted && !aChargePartenaire && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Mode de financement *</h3>
          <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
            Cette mission est à la charge d'ABED. Précisez comment le financement a été géré.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {MODE_OPTIONS.map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${modeFinancement === opt.value ? 'var(--abed-green)' : 'var(--abed-border)'}`,
                background: modeFinancement === opt.value ? '#f0fdf4' : 'var(--abed-bg)',
              }}>
                <input
                  type="radio"
                  name="mode_financement"
                  value={opt.value}
                  checked={modeFinancement === opt.value}
                  onChange={() => setModeFinancement(opt.value)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {!submitted && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Point financier</h3>
            <div className="table-wrap">
            <table>
              <thead><tr><th>Libellé</th><th>Qté</th><th>P. Unitaire (F)</th><th>Montant</th></tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td><input className="input" value={l.libelle}
                      onChange={e => updateLigne(i, { libelle: e.target.value })} /></td>
                    <td><input className="input" type="number" value={l.quantite} style={{ width: 70 }}
                      onChange={e => updateLigne(i, { quantite: +e.target.value })} /></td>
                    <td><input className="input" type="number" value={l.pu} style={{ width: 110 }}
                      onChange={e => updateLigne(i, { pu: +e.target.value })} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.montant.toLocaleString('fr-FR')} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <button className="btn secondary" style={{ marginTop: 12 }}
              onClick={() => setLignes([...lignes, { libelle: '', quantite: 1, pu: 0, montant: 0 }])}>
              + Ajouter une ligne
            </button>

            {showMontantRecu && (
              <div className="field" style={{ marginTop: 20, maxWidth: 300 }}>
                <label className="label">
                  {aChargePartenaire
                    ? 'Montant total reçu du partenaire (F CFA) *'
                    : modeFinancement === 'avance'
                      ? 'Montant de l\'avance reçue d\'ABED (F CFA) *'
                      : 'Montant total reçu d\'ABED avant départ (F CFA) *'}
                </label>
                <input className="input" type="number" value={montantRecu}
                  onChange={e => setMontantRecu(+e.target.value)} />
              </div>
            )}

            <div style={{ background: 'var(--abed-bg)', padding: 16, borderRadius: 8, marginTop: 12 }}>
              <Row label="Total dépenses" value={totalDepenses} />
              {showMontantRecu && <Row label="Montant reçu" value={montantRecu} />}
              {aChargePartenaire && <Row label="Solde missionnaire" value={montantRecu - totalDepenses} bold />}
              {!aChargePartenaire && modeFinancement === 'avance' && (
                <Row label="Reste dû par ABED" value={abedDoit} bold accent={abedDoit > 0} />
              )}
              {!aChargePartenaire && modeFinancement === 'totalite_avant' && (
                <Row label="Montant dû par ABED" value={0} bold />
              )}
              {!aChargePartenaire && modeFinancement === 'credit' && (
                <Row label="Montant dû par ABED" value={abedDoit} bold accent={abedDoit > 0} />
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Rapport de mission</h3>
            <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 16 }}>
              Tous les champs sont obligatoires. Ce rapport sera transmis au Directeur Exécutif et à la CAF.
            </p>
            {RAPPORT_FIELDS.map(([k, lbl]) => (
              <div className="field" key={k}>
                <label className="label">{lbl}</label>
                <textarea className="textarea" rows={3} value={rapport[k]}
                  style={{ borderColor: rapport[k].trim() ? 'var(--abed-border)' : '#f87171' }}
                  onChange={e => setRapport(r => ({ ...r, [k]: e.target.value }))} />
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Pièces jointes (optionnel)</h3>
            <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 12 }}>
              Vous pouvez joindre des documents justificatifs (Word, Excel ou PDF).
            </p>
            <input
              className="input"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => setPieces(prev => [...prev, ...Array.from(e.target.files ?? [])])}
            />
            {pieces.length > 0 && (
              <ul style={{ marginTop: 12, display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
                {pieces.map((f, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--abed-bg)', borderRadius: 6, padding: '6px 10px', fontSize: 13,
                  }}>
                    <span>📎 {f.name}</span>
                    <button type="button" className="btn secondary" style={{ padding: '2px 10px', fontSize: 12 }}
                      onClick={() => setPieces(prev => prev.filter((_, idx) => idx !== i))}>
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!submitted && donPossible && (
        <div className="card" style={{ border: '1px solid #a7f3d0', background: '#f7fdf9' }}>
          <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: '#065f46' }}>
            <Award size={18} /> Faire un don à ABED — {NOM_CLUB}
          </h3>
          <p style={{ fontSize: 12.5, color: '#047857', marginBottom: 14 }}>
            {aChargePartenaire
              ? 'Facultatif. Choisissez le pourcentage du montant reçu du partenaire que vous souhaitez offrir à ABED.'
              : 'Facultatif. Vous pouvez renoncer à tout ou partie du montant qu\'ABED vous doit — sans aucun versement de votre part.'}
            {' '}Les donateurs rejoignent {NOM_CLUB} et figurent au tableau d&apos;honneur annuel.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, marginBottom: donActif ? 14 : 0, cursor: 'pointer' }}>
            <input type="checkbox" checked={donActif} onChange={e => setDonActif(e.target.checked)} />
            Je souhaite faire un don
          </label>
          {donActif && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label className="label" style={{ margin: 0 }}>Pourcentage</label>
                <input className="input" type="number" min={1} max={100} value={donPourcentage}
                  onChange={e => setDonPourcentage(+e.target.value)} style={{ width: 90 }} />
                <span style={{ fontSize: 13 }}>% de {baseDon.toLocaleString('fr-FR')} F CFA =</span>
                <strong style={{ fontSize: 15, color: '#065f46' }}>{montantDuDon.toLocaleString('fr-FR')} F CFA</strong>
              </div>
              {aChargePartenaire ? (
                <>
                  <UssdDon montant={montantDuDon} />
                  <div className="field" style={{ margin: 0 }}>
                    <label className="label">Capture du paiement MoMo *</label>
                    <input className="input" type="file" accept="image/*,.pdf"
                      onChange={e => setDonCapture(e.target.files?.[0] ?? null)} />
                    <p style={{ fontSize: 11.5, color: 'var(--abed-muted)', margin: '4px 0 0' }}>
                      Effectuez le paiement, puis joignez la capture d&apos;écran du message de confirmation. Le don sera confirmé par l&apos;AAF/CAF.
                    </p>
                  </div>
                </>
              ) : (
                <Row label="Montant qu'ABED vous versera après don" value={Math.max(0, baseDon - montantDuDon)} bold />
              )}
            </div>
          )}
        </div>
      )}

      {!submitted && !aChargePartenaire && modeFinancement === 'totalite_avant' && (
        <p style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: '10px 14px', borderRadius: 8 }}>
          ✓ Totalité reçue avant départ — la mission sera clôturée automatiquement après validation.
        </p>
      )}

      {!submitted && !aChargePartenaire && (modeFinancement === 'credit' || modeFinancement === 'avance') && (
        <p style={{ fontSize: 13, color: 'var(--abed-amber)', background: '#fef3c7', padding: '10px 14px', borderRadius: 8 }}>
          ⚠ Votre réconciliation sera transmise à l'AAF, puis à la CAF, puis au Directeur Exécutif pour validation avant clôture définitive.
        </p>
      )}

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, fontSize: 14,
          background: msgType === 'ok' ? '#dcfce7' : msgType === 'warn' ? '#fef3c7' : '#fee2e2',
          color: msgType === 'ok' ? '#166534' : msgType === 'warn' ? '#92400e' : '#991b1b',
        }}>
          {msg}
        </div>
      )}

      {emailFailed && (
        <div style={{ background: '#fff7ed', border: '1px solid #f59e0b', borderRadius: 8, padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, color: '#92400e', fontSize: 14 }}>
            L'email aux gestionnaires (DE, CAF, AAF) n'a pas pu être envoyé. Vérifiez la configuration Resend puis réessayez.
          </p>
          <button className="btn" style={{ background: '#d97706' }} onClick={retryEmail} disabled={retryingEmail}>
            {retryingEmail ? '⏳ Envoi…' : '🔄 Réessayer l\'envoi de l\'email'}
          </button>
        </div>
      )}

      {!submitted && (
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? 'Traitement…' : 'Valider la réconciliation'}
        </button>
      )}
    </div>
  )
}

function Row({ label, value, bold, accent }: { label: string; value: number; bold?: boolean; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      fontWeight: bold ? 700 : 400, color: accent ? 'var(--abed-amber)' : 'inherit',
    }}>
      <span>{label}</span><span>{value.toLocaleString('fr-FR')} F CFA</span>
    </div>
  )
}
