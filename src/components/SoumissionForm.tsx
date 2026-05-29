'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type LigneTS = { date: string; activite: string; heures: number; imputation: string }

// Soumission d'un timesheet, d'une facture ou d'un livrable.
// Le prestataire donne un TITRE à chaque soumission.
export default function SoumissionForm({ managerId }: { managerId: string }) {
  const supabase = createClient()
  const [type, setType] = useState<'timesheet' | 'facture' | 'livrable'>('timesheet')
  const [titre, setTitre] = useState('')
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [montant, setMontant] = useState(0)
  const [lignes, setLignes] = useState<LigneTS[]>([
    { date: '', activite: '', heures: 0, imputation: '' },
  ])
  const [fichier, setFichier] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const totalHeures = lignes.reduce((s, l) => s + (l.heures || 0), 0)

  async function submit() {
    if (!titre.trim()) { setMsg('Donnez un titre à votre soumission.'); return }
    setLoading(true); setMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMsg('Session expirée.'); setLoading(false); return }

    let fichier_url: string | null = null
    if (fichier) {
      const path = `${user.id}/${Date.now()}_${fichier.name}`
      const { error: upErr } = await supabase.storage.from('livrables').upload(path, fichier)
      if (upErr) { setMsg('Upload échoué : ' + upErr.message); setLoading(false); return }
      fichier_url = path
    }

    const { error } = await supabase.from('soumissions').insert({
      prestataire_id: user.id,
      manager_id: managerId,
      titre,
      type,
      periode_mois: type === 'livrable' ? null : mois,
      periode_annee: type === 'livrable' ? null : annee,
      montant: type === 'facture' ? montant : null,
      contenu: type === 'timesheet' ? { lignes, total_heures: totalHeures } : null,
      fichier_url,
    })
    setLoading(false)
    if (error) { setMsg('Erreur : ' + error.message); return }
    setMsg('Soumission envoyée à votre responsable pour validation.')
    setTitre('')
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <h3>Nouvelle soumission</h3>

      <div className="field">
        <label className="label">Type</label>
        <select className="select" value={type} onChange={e => setType(e.target.value as any)}>
          <option value="timesheet">Timesheet</option>
          <option value="facture">Facture</option>
          <option value="livrable">Livrable</option>
        </select>
      </div>

      <div className="field">
        <label className="label">Titre de la soumission *</label>
        <input className="input" value={titre} placeholder="Ex : Timesheet mai – Accompagnement startups"
          onChange={e => setTitre(e.target.value)} />
      </div>

      {type !== 'livrable' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="label">Mois (période)</label>
            <input className="input" type="number" min={1} max={12} value={mois}
              onChange={e => setMois(+e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="label">Année</label>
            <input className="input" type="number" value={annee}
              onChange={e => setAnnee(+e.target.value)} />
          </div>
        </div>
      )}

      {type === 'timesheet' && (
        <div>
          <label className="label">Lignes d'activité</label>
          <table>
            <thead><tr><th>Date</th><th>Activité</th><th>Heures</th><th>Imputation</th></tr></thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td><input className="input" type="date" value={l.date}
                    onChange={e => setLignes(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} /></td>
                  <td><input className="input" value={l.activite}
                    onChange={e => setLignes(p => p.map((x, j) => j === i ? { ...x, activite: e.target.value } : x))} /></td>
                  <td><input className="input" type="number" value={l.heures} style={{ width: 70 }}
                    onChange={e => setLignes(p => p.map((x, j) => j === i ? { ...x, heures: +e.target.value } : x))} /></td>
                  <td><input className="input" value={l.imputation}
                    onChange={e => setLignes(p => p.map((x, j) => j === i ? { ...x, imputation: e.target.value } : x))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button className="btn secondary"
              onClick={() => setLignes([...lignes, { date: '', activite: '', heures: 0, imputation: '' }])}>
              + Ligne
            </button>
            <strong>Total : {totalHeures} h</strong>
          </div>
        </div>
      )}

      {type === 'facture' && (
        <div className="field">
          <label className="label">Montant (F CFA)</label>
          <input className="input" type="number" value={montant} onChange={e => setMontant(+e.target.value)} />
        </div>
      )}

      <div className="field">
        <label className="label">Pièce jointe {type === 'livrable' ? '(le livrable)' : '(facture / justificatif)'}</label>
        <input className="input" type="file" onChange={e => setFichier(e.target.files?.[0] ?? null)} />
      </div>

      {msg && <p style={{ fontSize: 14 }}>{msg}</p>}
      <button className="btn" onClick={submit} disabled={loading}>
        {loading ? 'Envoi…' : 'Soumettre pour validation'}
      </button>
    </div>
  )
}
