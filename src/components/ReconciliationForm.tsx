'use client'
import { useState } from 'react'

type Ligne = { libelle: string; quantite: number; pu: number; montant: number }

// Formulaire de réconciliation post-mission (dans les 72h).
// - Point financier : tableau de libellés saisi par le missionnaire
// - Rapport : compte rendu de mission
// - À la validation : si mission à charge partenaire, déclenche le push MoMo (20%)
export default function ReconciliationForm({
  missionId,
  aChargePartenaire,
}: {
  missionId: string
  aChargePartenaire: boolean
}) {
  const [lignes, setLignes] = useState<Ligne[]>([
    { libelle: '', quantite: 1, pu: 0, montant: 0 },
  ])
  const [montantRecu, setMontantRecu] = useState(0)
  const [rapport, setRapport] = useState({
    objectifs: '', activites: '', resultats: '', difficultes: '', suite: '',
  })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const totalDepenses = lignes.reduce((s, l) => s + (l.montant || 0), 0)
  const prelevement = aChargePartenaire ? Math.round(montantRecu * 0.2) : 0
  const solde = montantRecu - totalDepenses - prelevement

  function updateLigne(i: number, patch: Partial<Ligne>) {
    setLignes(prev => prev.map((l, idx) => {
      if (idx !== i) return l
      const next = { ...l, ...patch }
      next.montant = (next.quantite || 0) * (next.pu || 0)
      return next
    }))
  }

  async function submit() {
    setLoading(true); setMsg('')
    const res = await fetch(`/api/missions/${missionId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // l'id passe par l'URL côté route ; ici on l'inclut dans le body simplifié
        point_financier: lignes,
        montant_recu: montantRecu,
        rapport,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setMsg('Erreur : ' + (data.error ?? 'inconnue')); return }
    setMsg(data.message ?? 'Réconciliation enregistrée. Mission clôturée.')
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Point financier</h3>
        <table>
          <thead>
            <tr><th>Libellé</th><th>Qté</th><th>P. Unitaire</th><th>Montant</th></tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <td><input className="input" value={l.libelle}
                  onChange={e => updateLigne(i, { libelle: e.target.value })} /></td>
                <td><input className="input" type="number" value={l.quantite}
                  onChange={e => updateLigne(i, { quantite: +e.target.value })} style={{ width: 70 }} /></td>
                <td><input className="input" type="number" value={l.pu}
                  onChange={e => updateLigne(i, { pu: +e.target.value })} style={{ width: 110 }} /></td>
                <td>{l.montant.toLocaleString('fr-FR')} F</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn secondary" style={{ marginTop: 12 }}
          onClick={() => setLignes([...lignes, { libelle: '', quantite: 1, pu: 0, montant: 0 }])}>
          + Ajouter une ligne
        </button>

        <div className="field" style={{ marginTop: 20, maxWidth: 280 }}>
          <label className="label">Montant total reçu du partenaire (F CFA)</label>
          <input className="input" type="number" value={montantRecu}
            onChange={e => setMontantRecu(+e.target.value)} />
        </div>

        <div style={{ background: 'var(--abed-bg)', padding: 16, borderRadius: 8, marginTop: 8 }}>
          <Row label="Total dépenses" value={totalDepenses} />
          <Row label="Montant reçu" value={montantRecu} />
          {aChargePartenaire && <Row label="Prélèvement ABED (20%)" value={prelevement} accent />}
          <Row label="Solde missionnaire" value={solde} bold />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Rapport de mission</h3>
        {([
          ['objectifs', 'Objectifs'],
          ['activites', 'Activités menées'],
          ['resultats', 'Résultats obtenus'],
          ['difficultes', 'Difficultés rencontrées'],
          ['suite', 'Suite à donner'],
        ] as const).map(([k, lbl]) => (
          <div className="field" key={k}>
            <label className="label">{lbl}</label>
            <textarea className="textarea" rows={3} value={(rapport as any)[k]}
              onChange={e => setRapport({ ...rapport, [k]: e.target.value })} />
          </div>
        ))}
      </div>

      {aChargePartenaire && prelevement > 0 && (
        <p style={{ fontSize: 13, color: 'var(--abed-amber)' }}>
          ⚠ À la validation, un push MTN Mobile Money de {prelevement.toLocaleString('fr-FR')} F CFA
          sera envoyé sur votre téléphone. Confirmez-le pour clôturer la mission.
        </p>
      )}

      {msg && <p style={{ fontSize: 14 }}>{msg}</p>}
      <button className="btn" onClick={submit} disabled={loading}>
        {loading ? 'Traitement…' : 'Valider la réconciliation'}
      </button>
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
