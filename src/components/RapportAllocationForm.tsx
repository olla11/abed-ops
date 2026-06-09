'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'

type Rapport = {
  id: string; periode_mois: number; periode_annee: number
  rapport_texte: string; montant_allocation: number | null; status: string
  commentaire_manager: string | null; commentaire_aaf: string | null
  commentaire_caf: string | null; commentaire_de: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:          { label: 'En attente responsable',  color: '#92660b' },
  valide_tech:     { label: 'Validé — attente AAF',    color: '#1e40af' },
  traite_aaf:      { label: 'Traité AAF — att. CAF',   color: '#6d28d9' },
  valide_caf:      { label: 'Validé CAF — att. DE',    color: '#0f766e' },
  autorise:        { label: '✓ Autorisé ✓',            color: '#166534' },
  rejete_manager:  { label: '✗ Rejeté (responsable)',  color: '#991b1b' },
  rejete_aaf:      { label: '✗ Rejeté (AAF)',          color: '#991b1b' },
  rejete_caf:      { label: '✗ Rejeté (CAF)',          color: '#991b1b' },
  refuse_de:       { label: '✗ Refusé (DE)',           color: '#991b1b' },
}

const REJETE = ['rejete_manager','rejete_aaf','rejete_caf','refuse_de']

async function uploadWordFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('slot', 'rapport')
  const res = await fetch('/api/timesheets/upload', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur upload')
  return json.path as string
}

export default function RapportAllocationForm({ typeEmploi }: { typeEmploi?: string | null }) {
  const estSalarie = typeEmploi === 'cdd' || typeEmploi === 'cdi'
  const supabase = createClient()
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [texte, setTexte] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Rapport[]>([])
  const [resoumission, setResoumission] = useState<{ id: string; texte: string; fichier: File | null } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reFileRef = useRef<HTMLInputElement>(null)

  async function loadHistory() {
    const res = await fetch('/api/rapports-allocations')
    const json = await res.json()
    setHistory(json.data ?? [])
  }

  useEffect(() => { loadHistory() }, [])

  function validateFile(f: File | null): string | null {
    if (!f) return 'Le document Word est obligatoire.'
    const name = f.name.toLowerCase()
    if (!name.endsWith('.doc') && !name.endsWith('.docx'))
      return 'Seuls les fichiers Word (.doc ou .docx) sont acceptés.'
    return null
  }

  async function submit() {
    if (!texte.trim()) { setMsg('Le résumé des activités est obligatoire.'); return }
    const ferr = validateFile(fichier)
    if (ferr) { setMsg(ferr); return }

    setLoading(true); setMsg('Envoi en cours…')
    try {
      const fichier_url = await uploadWordFile(fichier!)
      const res = await fetch('/api/rapports-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode_mois: mois, periode_annee: annee,
          rapport_texte: texte, fichier_rapport_url: fichier_url }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); return }
      setMsg('✓ Rapport soumis à votre responsable.')
      setTexte(''); setFichier(null)
      if (fileRef.current) fileRef.current.value = ''
      loadHistory()
    } catch (e: any) {
      setMsg('Erreur : ' + e.message)
    } finally { setLoading(false) }
  }

  async function resoumettre() {
    if (!resoumission) return
    if (!resoumission.texte.trim()) { setMsg('Le résumé des activités est obligatoire.'); return }
    const ferr = validateFile(resoumission.fichier)
    if (ferr) { setMsg(ferr); return }
    setLoading(true); setMsg('Resoumission en cours…')
    try {
      const fichier_url = await uploadWordFile(resoumission.fichier!)
      const res = await fetch(`/api/rapports-allocations/${resoumission.id}/resoumettre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rapport_texte: resoumission.texte, fichier_rapport_url: fichier_url }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); return }
      setMsg('✓ Rapport re-soumis.')
      setResoumission(null)
      loadHistory()
    } catch (e: any) {
      setMsg('Erreur : ' + e.message)
    } finally { setLoading(false) }
  }

  const toCorrect = history.filter(r => REJETE.includes(r.status))
  const others = history.filter(r => !REJETE.includes(r.status))

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ── Formulaire de soumission ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>
          {estSalarie ? 'Rapport mensuel — Fiche de paie' : 'Rapport mensuel d\'activité'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
          {estSalarie
            ? 'Soumettez votre rapport. L\'AAF génèrera votre fiche de paie, validée par la CAF et autorisée par le DE.'
            : 'Soumettez votre rapport. Une fois validé (Responsable → AAF → CAF → DE), vous recevrez votre état de paiement.'}
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
          <label className="label">Résumé des activités, résultats et difficultés *</label>
          <textarea className="input" rows={6} value={texte}
            placeholder="Décrivez les activités réalisées ce mois, les résultats obtenus, les difficultés rencontrées et les perspectives…"
            onChange={e => setTexte(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">
            Document Word (.doc / .docx) *
            <span style={{ fontSize: 11, fontWeight: 400, color: '#991b1b', marginLeft: 6 }}>obligatoire</span>
          </label>
          <input ref={fileRef} className="input" type="file" accept=".doc,.docx"
            onChange={e => setFichier(e.target.files?.[0] ?? null)} />
          <span style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4, display: 'block' }}>
            Seuls les fichiers Word sont acceptés.
          </span>
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

      {/* ── Rapports à corriger ── */}
      {toCorrect.map(r => {
        const st = STATUS_LABEL[r.status]
        const comment = r.commentaire_manager || r.commentaire_aaf || r.commentaire_caf || r.commentaire_de
        const isEditing = resoumission?.id === r.id
        return (
          <div key={r.id} className="card" style={{ borderLeft: '4px solid #c0392b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                <div style={{ fontWeight: 600, marginTop: 2 }}>Rapport {r.periode_mois}/{r.periode_annee}</div>
              </div>
              {!isEditing && (
                <button className="btn secondary" style={{ fontSize: 12 }}
                  onClick={() => setResoumission({ id: r.id, texte: r.rapport_texte ?? '', fichier: null })}>
                  Corriger et re-soumettre
                </button>
              )}
            </div>
            {comment && (
              <p style={{ fontSize: 12, color: '#991b1b', marginTop: 8, fontStyle: 'italic',
                background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
                Motif : {comment}
              </p>
            )}
            {isEditing && (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div className="field">
                  <label className="label">Résumé corrigé *</label>
                  <textarea className="input" rows={5}
                    value={resoumission.texte}
                    onChange={e => setResoumission(s => s ? { ...s, texte: e.target.value } : null)} />
                </div>
                <div className="field">
                  <label className="label">
                    Nouveau document Word *
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#991b1b', marginLeft: 6 }}>obligatoire</span>
                  </label>
                  <input ref={reFileRef} className="input" type="file" accept=".doc,.docx"
                    onChange={e => setResoumission(s => s ? { ...s, fichier: e.target.files?.[0] ?? null } : null)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={resoumettre} disabled={loading}>
                    {loading ? '⏳…' : '↩ Re-soumettre'}
                  </button>
                  <button className="btn secondary" onClick={() => setResoumission(null)}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Historique ── */}
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
                      {estSalarie ? 'Salaire net : ' : ''}{r.montant_allocation.toLocaleString('fr-FR')} XOF
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
