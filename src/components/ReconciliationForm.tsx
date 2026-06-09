'use client'
import { useState } from 'react'

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
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'warn'>('ok')
  const [loading, setLoading] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)
  const [retryingEmail, setRetryingEmail] = useState(false)

  const totalDepenses = lignes.reduce((s, l) => s + (l.montant || 0), 0)
  const prelevement = aChargePartenaire ? Math.round(montantRecu * 0.2) : 0

  const abedDoit = !aChargePartenaire
    ? modeFinancement === 'totalite_avant'
      ? 0
      : modeFinancement === 'avance'
        ? Math.max(0, totalDepenses - montantRecu)
        : totalDepenses
    : 0

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
    return null
  }

  async function submit() {
    const err = validate()
    if (err) { setMsg(err); setMsgType('err'); return }
    setLoading(true); setMsg(''); setPaymentFailed(false); setEmailFailed(false)
    const res = await fetch(`/api/missions/${missionId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        point_financier: lignes,
        montant_recu: montantRecu,
        rapport,
        mode_financement: aChargePartenaire ? null : modeFinancement,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      const isFedapay = data.error?.includes('FedaPay') || data.error?.includes('fedapay')
      setMsg('Erreur : ' + (data.error ?? 'inconnue'))
      setMsgType('err')
      if (isFedapay) setPaymentFailed(true)
      return
    }
    setSubmitted(true)
    setMsg(data.message ?? 'Réconciliation enregistrée.')
    setMsgType(data.status === 'reconciliation_caf' ? 'warn' : 'ok')
    if (data.email_sent === false) {
      setEmailFailed(true)
    }
  }

  async function retryPayment() {
    setRetrying(true); setMsg(''); setPaymentFailed(false)
    const res = await fetch(`/api/missions/${missionId}/retry-payment`, { method: 'POST' })
    const data = await res.json()
    setRetrying(false)
    if (!res.ok) {
      setMsg('Erreur : ' + (data.error ?? 'inconnue'))
      setMsgType('err')
      setPaymentFailed(true)
    } else {
      setMsg(data.message ?? 'Push MoMo envoyé. Confirmez sur votre téléphone.')
      setMsgType('warn')
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
      setMsg('Email envoyé avec succès au DE et à la CAF.')
      setMsgType('ok')
    }
  }

  const showMontantRecu = aChargePartenaire || modeFinancement === 'avance' || modeFinancement === 'totalite_avant'

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {commentaireRejet && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', borderRadius: 8, padding: '12px 16px' }}>
          <strong style={{ color: '#991b1b', fontSize: 14 }}>Réconciliation rejetée par la CAF</strong>
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
                    <td style={{ whiteSpace: 'nowrap' }}>{l.montant.toLocaleString('fr-FR')} XOF</td>
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
              {aChargePartenaire && <Row label="Prélèvement ABED (20%)" value={prelevement} accent />}
              {aChargePartenaire && <Row label="Solde missionnaire" value={montantRecu - totalDepenses - prelevement} bold />}
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
        </>
      )}

      {aChargePartenaire && prelevement > 0 && !submitted && (
        <p style={{ fontSize: 13, color: 'var(--abed-amber)', background: '#fef3c7', padding: '10px 14px', borderRadius: 8 }}>
          ⚠ À la validation, un push MTN Mobile Money de <strong>{prelevement.toLocaleString('fr-FR')} XOF</strong> sera
          envoyé sur votre téléphone. Confirmez-le pour clôturer la mission.
        </p>
      )}

      {!submitted && !aChargePartenaire && modeFinancement === 'totalite_avant' && (
        <p style={{ fontSize: 13, color: '#166534', background: '#dcfce7', padding: '10px 14px', borderRadius: 8 }}>
          ✓ Totalité reçue avant départ — la mission sera clôturée automatiquement après validation.
        </p>
      )}

      {!submitted && !aChargePartenaire && (modeFinancement === 'credit' || modeFinancement === 'avance') && (
        <p style={{ fontSize: 13, color: 'var(--abed-amber)', background: '#fef3c7', padding: '10px 14px', borderRadius: 8 }}>
          ⚠ Votre réconciliation sera transmise à la CAF pour validation avant clôture définitive.
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
            L'email au DE et à la CAF n'a pas pu être envoyé. Vérifiez la configuration Resend puis réessayez.
          </p>
          <button className="btn" style={{ background: '#d97706' }} onClick={retryEmail} disabled={retryingEmail}>
            {retryingEmail ? '⏳ Envoi…' : '🔄 Réessayer l\'envoi de l\'email'}
          </button>
        </div>
      )}

      {paymentFailed && (
        <div style={{ background: '#fff7ed', border: '1px solid #f59e0b', borderRadius: 8, padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, color: '#92400e' }}>
            Le prélèvement MTN MoMo a échoué. Vous pouvez réessayer ci-dessous.
          </p>
          <button className="btn" style={{ background: '#d97706' }} onClick={retryPayment} disabled={retrying}>
            {retrying ? '⏳ Envoi en cours…' : '🔄 Réessayer le prélèvement MTN MoMo'}
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
      <span>{label}</span><span>{value.toLocaleString('fr-FR')} XOF</span>
    </div>
  )
}
