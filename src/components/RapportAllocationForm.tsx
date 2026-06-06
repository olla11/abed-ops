'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Rapport = {
  id: string; periode_mois: number; periode_annee: number
  rapport_texte: string; montant_allocation: number | null; status: string
  commentaire_manager: string | null; commentaire_aaf: string | null
  commentaire_caf: string | null; commentaire_de: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:          { label: 'En attente manager',   color: '#92660b' },
  valide_tech:     { label: 'Validé — attente AAF', color: '#1e40af' },
  traite_aaf:      { label: 'Traité AAF — att. CAF',color: '#6d28d9' },
  valide_caf:      { label: 'Validé CAF — att. DE', color: '#0f766e' },
  autorise:        { label: '✓ Autorisé ✓',         color: '#166534' },
  rejete_manager:  { label: '✗ Rejeté (manager)',   color: '#991b1b' },
  rejete_aaf:      { label: '✗ Rejeté (AAF)',       color: '#991b1b' },
  rejete_caf:      { label: '✗ Rejeté (CAF)',       color: '#991b1b' },
  refuse_de:       { label: '✗ Refusé (DE)',        color: '#991b1b' },
}

const REJETE = ['rejete_manager','rejete_aaf','rejete_caf','refuse_de']

export default function RapportAllocationForm() {
  const supabase = createClient()
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [texte, setTexte] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Rapport[]>([])

  async function loadHistory() {
    const res = await fetch('/api/rapports-allocations')
    const json = await res.json()
    setHistory(json.data ?? [])
  }

  useEffect(() => { loadHistory() }, [])

  async function submit() {
    if (!texte.trim()) { setMsg('Le rapport est obligatoire.'); return }
    setLoading(true); setMsg('')
    try {
      let fichier_url = ''
      if (fichier) {
        const fd = new FormData(); fd.append('file', fichier); fd.append('slot', 'rapport')
        const up = await fetch('/api/timesheets/upload', { method: 'POST', body: fd })
        const upj = await up.json()
        if (!up.ok) { setMsg('Erreur upload : ' + upj.error); setLoading(false); return }
        fichier_url = upj.path
      }
      const res = await fetch('/api/rapports-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode_mois: mois, periode_annee: annee,
          rapport_texte: texte, fichier_rapport_url: fichier_url || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); return }
      setMsg('✓ Rapport soumis à votre responsable.'); setTexte(''); loadHistory()
    } finally { setLoading(false) }
  }

  const toCorrect = history.filter(r => REJETE.includes(r.status))
  const others = history.filter(r => !REJETE.includes(r.status))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Rapport mensuel */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Rapport mensuel d'activité</h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
          Soumettez votre rapport en fin de mois pour déclencher le traitement de votre allocation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Mois *</label>
            <input className="input" type="number" min={1} max={12} value={mois}
              onChange={e => setMois(+e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Année *</label>
            <input className="input" type="number" value={annee}
              onChange={e => setAnnee(+e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label">Rapport d'activité *</label>
          <textarea className="input" rows={5} value={texte}
            placeholder="Décrivez les activités réalisées ce mois, les résultats obtenus, les difficultés rencontrées…"
            onChange={e => setTexte(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Document joint (optionnel)</label>
          <input className="input" type="file" accept=".pdf,.doc,.docx"
            onChange={e => setFichier(e.target.files?.[0] ?? null)} />
        </div>
        {msg && (
          <p style={{ fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 8,
            background: msg.startsWith('✓') ? '#dcfce7' : '#fee2e2',
            color: msg.startsWith('✓') ? '#166534' : '#991b1b' }}>{msg}</p>
        )}
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? '⏳ Envoi…' : 'Soumettre le rapport'}
        </button>
      </div>

      {/* À corriger */}
      {toCorrect.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #c0392b' }}>
          <h3 style={{ color: '#991b1b', marginBottom: 12 }}>Rapports rejetés ({toCorrect.length})</h3>
          {toCorrect.map(r => {
            const st = STATUS_LABEL[r.status]
            const comment = r.commentaire_manager || r.commentaire_aaf || r.commentaire_caf || r.commentaire_de
            return (
              <div key={r.id} style={{ background: '#fff5f5', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.periode_mois}/{r.periode_annee}</strong>
                  <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.label}</span>
                </div>
                {comment && <p style={{ fontSize: 12, color: '#991b1b', marginTop: 6, fontStyle: 'italic' }}>
                  Motif : {comment}
                </p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Historique */}
      {others.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Mes rapports</h3>
          {others.map(r => {
            const st = STATUS_LABEL[r.status] ?? { label: r.status, color: '#374151' }
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid var(--abed-border)', padding: '10px 0', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{r.periode_mois}/{r.periode_annee}</strong>
                  {r.montant_allocation != null && (
                    <span style={{ fontSize: 12, color: '#166534', marginLeft: 10, fontWeight: 600 }}>
                      {r.montant_allocation.toLocaleString('fr-FR')} FCFA
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: st.color + '22', color: st.color }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
