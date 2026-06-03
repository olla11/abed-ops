'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string; status: string
  periode_mois: number; periode_annee: number
  heures_retenues: number; justification_heures: string | null
  fichier_facture_url: string | null; fichier_timesheet_url: string | null
  prestataire: { prenoms: string; nom: string } | null
}

const TAUX = 1500

export default function ValidationCAF() {
  const supabase = createClient()
  const [items, setItems] = useState<Soumission[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [urlCache, setUrlCache] = useState<Record<string, string>>({})

  async function load() {
    const { data } = await supabase
      .from('soumissions')
      .select('id,titre,status,periode_mois,periode_annee,heures_retenues,justification_heures,fichier_facture_url,fichier_timesheet_url,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
      .eq('status', 'valide_tech')
      .order('created_at', { ascending: false })
    setItems((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openFile(path: string | null) {
    if (!path) return
    if (urlCache[path]) { window.open(urlCache[path], '_blank'); return }
    const { data } = await supabase.storage.from('timesheets').createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      setUrlCache(c => ({ ...c, [path]: data.signedUrl }))
      window.open(data.signedUrl, '_blank')
    }
  }

  async function decider(id: string, action: 'valider' | 'corriger' | 'rejeter') {
    if (action !== 'valider') {
      const c = commentMap[id]?.trim()
      if (!c) { alert('Un commentaire est obligatoire.'); return }
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
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Validation CAF — Contrôle des factures ({items.length})</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Les dossiers ci-dessous ont été validés techniquement par le manager.
        Vérifiez la facture et validez le montant (1 h = 1 500 FCFA).
      </p>

      {items.length === 0 && (
        <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun dossier en attente.</p>
      )}

      {items.map(s => {
        const isOpen = expanded === s.id
        const montant = Math.round(s.heures_retenues * TAUX)

        return (
          <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : s.id)}>
              <div>
                <strong>{s.titre}</strong>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                  {s.prestataire?.prenoms} {s.prestataire?.nom} — {s.periode_mois}/{s.periode_annee}
                  {' '}— <strong>{s.heures_retenues} h</strong> retenues
                  {' '}→ <strong style={{ color: 'var(--abed-green)' }}>{montant.toLocaleString('fr-FR')} FCFA</strong>
                </span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--abed-green)' }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                {/* Informations */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Montant à payer : {montant.toLocaleString('fr-FR')} FCFA
                    ({s.heures_retenues} h × 1 500 F)
                  </p>
                  {s.justification_heures && (
                    <p style={{ fontSize: 12, color: 'var(--abed-muted)', fontStyle: 'italic' }}>
                      Justification manager : {s.justification_heures}
                    </p>
                  )}
                </div>

                {/* Fichiers */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.fichier_facture_url && (
                    <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_facture_url)}>
                      🧾 Ouvrir Facture PDF
                    </button>
                  )}
                  {s.fichier_timesheet_url && (
                    <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_timesheet_url)}>
                      📊 Ouvrir Timesheet
                    </button>
                  )}
                </div>

                {/* Commentaire */}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet ou correction)</label>
                  <textarea className="input" rows={2}
                    value={commentMap[s.id] ?? ''}
                    placeholder="Motif de rejet ou demande de correction…"
                    onChange={e => setCommentMap(m => ({ ...m, [s.id]: e.target.value }))} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn"
                    style={{ background: '#166534', fontSize: 13 }}
                    disabled={submitting === s.id}
                    onClick={() => decider(s.id, 'valider')}>
                    ✓ Valider — {montant.toLocaleString('fr-FR')} FCFA
                  </button>
                  <button className="btn danger" style={{ fontSize: 13 }}
                    disabled={submitting === s.id}
                    onClick={() => decider(s.id, 'corriger')}>
                    Demander correction facture
                  </button>
                  <button className="btn danger" style={{ fontSize: 13, background: '#7f1d1d' }}
                    disabled={submitting === s.id}
                    onClick={() => decider(s.id, 'rejeter')}>
                    Rejeter
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
