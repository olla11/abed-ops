'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string
  periode_mois: number; periode_annee: number
  heures_retenues: number; justification_heures: string | null
  fichier_facture_url: string | null; fichier_timesheet_url: string | null; fichier_livrable_url: string | null
  prestataire: { prenoms: string; nom: string } | null
}

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir le fichier : ' + (json.error ?? 'erreur'))
}

export default function ValidationCAF() {
  const supabase = createClient()
  const [items, setItems] = useState<Soumission[]>([])
  const [loading, setLoading] = useState(true)
  const [taux, setTaux] = useState(1500)
  const [newTaux, setNewTaux] = useState('')
  const [tauxMsg, setTauxMsg] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  async function load() {
    const [{ data }, tauxRes] = await Promise.all([
      supabase
        .from('soumissions')
        .select('id,titre,periode_mois,periode_annee,heures_retenues,justification_heures,fichier_facture_url,fichier_timesheet_url,fichier_livrable_url,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
        .eq('status', 'valide_tech')
        .order('created_at', { ascending: false }),
      fetch('/api/config/taux').then(r => r.json()),
    ])
    setItems((data as any) ?? [])
    if (tauxRes.taux) { setTaux(tauxRes.taux); setNewTaux(String(tauxRes.taux)) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveTaux() {
    const res = await fetch('/api/config/taux', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux: newTaux }),
    })
    const json = await res.json()
    if (res.ok) { setTaux(json.taux); setTauxMsg(`✓ Taux mis à jour : ${json.taux.toLocaleString('fr-FR')} FCFA/h`) }
    else setTauxMsg('Erreur : ' + json.error)
    setTimeout(() => setTauxMsg(''), 3000)
  }

  async function decider(id: string, action: 'valider' | 'corriger' | 'rejeter') {
    if (action !== 'valider' && !commentMap[id]?.trim()) {
      alert('Un commentaire est obligatoire.'); return
    }
    setSubmitting(id)
    const res = await fetch(`/api/timesheets/${id}/valider-caf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire_caf: commentMap[id] }),
    })
    const json = await res.json()
    if (!res.ok) alert('Erreur : ' + json.error)
    setSubmitting(null); load()
  }

  if (loading) return <p>Chargement…</p>

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Paramètre taux horaire */}
      <div className="card" style={{ borderLeft: '4px solid var(--abed-green)' }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>⚙️ Paramètre : Taux horaire</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Taux horaire (FCFA/h) :</label>
          <input className="input" type="number" min={100} step={50} style={{ width: 120 }}
            value={newTaux} onChange={e => setNewTaux(e.target.value)} />
          <button className="btn" style={{ fontSize: 13 }} onClick={saveTaux}>Enregistrer</button>
          {tauxMsg && (
            <span style={{ fontSize: 13, color: tauxMsg.startsWith('✓') ? '#166534' : '#991b1b' }}>
              {tauxMsg}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 6 }}>
          Taux actuel : <strong>{taux.toLocaleString('fr-FR')} FCFA/h</strong> — appliqué à toutes les validations à venir.
        </p>
      </div>

      {/* Dossiers à valider */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Validation CAF — Contrôle des factures ({items.length})</h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
          Dossiers validés techniquement par le manager. Vérifiez la facture et validez le montant.
        </p>

        {items.length === 0 && (
          <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun dossier en attente.</p>
        )}

        {items.map(s => {
          const isOpen = expanded === s.id
          const montant = Math.round((s.heures_retenues ?? 0) * taux)

          return (
            <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : s.id)}>
                <div>
                  <strong>{s.titre}</strong>
                  <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                    {s.prestataire?.prenoms} {s.prestataire?.nom}
                    {' '}— {s.periode_mois}/{s.periode_annee}
                    {' '}— <strong>{s.heures_retenues} h</strong>
                    {' '}→ <strong style={{ color: 'var(--abed-green)' }}>{montant.toLocaleString('fr-FR')} FCFA</strong>
                  </span>
                </div>
                <span style={{ fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      Montant à valider : {montant.toLocaleString('fr-FR')} FCFA
                      ({s.heures_retenues} h × {taux.toLocaleString('fr-FR')} F)
                    </p>
                    {s.justification_heures && (
                      <p style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 4, fontStyle: 'italic' }}>
                        Justification manager : {s.justification_heures}
                      </p>
                    )}
                  </div>

                  {/* Fichiers */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {s.fichier_facture_url && (
                      <button className="btn secondary" style={{ fontSize: 12 }}
                        onClick={() => openFile(s.fichier_facture_url!)}>
                        🧾 Télécharger Facture PDF
                      </button>
                    )}
                    {s.fichier_timesheet_url && (
                      <button className="btn secondary" style={{ fontSize: 12 }}
                        onClick={() => openFile(s.fichier_timesheet_url!)}>
                        📊 Télécharger Timesheet
                      </button>
                    )}
                    {s.fichier_livrable_url && (
                      <button className="btn secondary" style={{ fontSize: 12 }}
                        onClick={() => openFile(s.fichier_livrable_url!)}>
                        📄 Télécharger Livrable
                      </button>
                    )}
                  </div>

                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Commentaire (obligatoire si rejet ou correction)</label>
                    <textarea className="input" rows={2}
                      value={commentMap[s.id] ?? ''}
                      placeholder="Motif de rejet ou demande de correction…"
                      onChange={e => setCommentMap(m => ({ ...m, [s.id]: e.target.value }))} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: '#166534', fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'valider')}>
                      ✓ Valider — {montant.toLocaleString('fr-FR')} FCFA
                    </button>
                    <button className="btn danger" style={{ fontSize: 13 }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'corriger')}>
                      Correction facture
                    </button>
                    <button className="btn danger" style={{ fontSize: 13, background: '#7f1d1d' }}
                      disabled={submitting === s.id} onClick={() => decider(s.id, 'rejeter')}>
                      Rejeter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
