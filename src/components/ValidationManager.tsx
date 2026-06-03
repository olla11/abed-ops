'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string; status: string
  periode_mois: number; periode_annee: number
  heures_declarees: number; heures_retenues: number | null
  fichier_timesheet_url: string | null; fichier_livrable_url: string | null
  prestataire: { prenoms: string; nom: string } | null
}

const TAUX = 1500

export default function ValidationManager() {
  const supabase = createClient()
  const [items, setItems] = useState<Soumission[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [heuresMap, setHeuresMap] = useState<Record<string, number | ''>>({})
  const [justifMap, setJustifMap] = useState<Record<string, string>>({})
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [needsJustif, setNeedsJustif] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [urlCache, setUrlCache] = useState<Record<string, string>>({})

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('soumissions')
      .select('id,titre,status,periode_mois,periode_annee,heures_declarees,heures_retenues,fichier_timesheet_url,fichier_livrable_url,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
      .eq('manager_id', user.id)
      .in('status', ['soumis'])
      .order('created_at', { ascending: false })
    setItems((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function getSignedUrl(path: string): Promise<string> {
    if (urlCache[path]) return urlCache[path]
    const { data } = await supabase.storage.from('timesheets').createSignedUrl(path, 3600)
    const url = data?.signedUrl ?? '#'
    setUrlCache(c => ({ ...c, [path]: url }))
    return url
  }

  async function openFile(path: string | null) {
    if (!path) return
    const url = await getSignedUrl(path)
    window.open(url, '_blank')
  }

  async function valider(id: string) {
    const h = heuresMap[id]
    if (!h || h <= 0) { alert('Saisissez les heures retenues.'); return }
    const soum = items.find(s => s.id === id)
    if (soum && +h < soum.heures_declarees && !justifMap[id]?.trim()) {
      setNeedsJustif(id)
      return
    }
    setSubmitting(id)
    const res = await fetch(`/api/timesheets/${id}/valider-tech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'valider', heures_retenues: h, justification_heures: justifMap[id] }),
    })
    const json = await res.json()
    if (!res.ok) {
      if (json.requiresJustification) { setNeedsJustif(id); setSubmitting(null); return }
      alert('Erreur : ' + json.error)
    }
    setSubmitting(null); setNeedsJustif(null); load()
  }

  async function rejeter(id: string, action: 'corriger_ts' | 'corriger_livrable' | 'rejeter') {
    const c = commentMap[id]?.trim()
    if (!c) { alert('Un commentaire est obligatoire.'); return }
    setSubmitting(id)
    await fetch(`/api/timesheets/${id}/valider-tech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, commentaire_manager: c }),
    })
    setSubmitting(null); load()
  }

  if (loading) return <p>Chargement…</p>

  return (
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Dossiers à valider techniquement ({items.length})</h3>

      {items.length === 0 && (
        <p style={{ color: 'var(--abed-muted)', fontSize: 14 }}>Aucun dossier en attente.</p>
      )}

      {items.map(s => {
        const isOpen = expanded === s.id
        const h = heuresMap[s.id]
        const montantEstimé = h ? Math.round(+h * TAUX).toLocaleString('fr-FR') : '—'

        return (
          <div key={s.id} style={{ borderBottom: '1px solid var(--abed-border)', padding: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : s.id)}>
              <div>
                <strong>{s.titre}</strong>
                <span style={{ fontSize: 12, color: 'var(--abed-muted)', marginLeft: 10 }}>
                  {s.prestataire?.prenoms} {s.prestataire?.nom} — {s.periode_mois}/{s.periode_annee} — {s.heures_declarees} h déclarées
                </span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--abed-green)' }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
                {/* Fichiers */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {s.fichier_timesheet_url && (
                    <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_timesheet_url)}>
                      📊 Ouvrir Timesheet Excel
                    </button>
                  )}
                  {s.fichier_livrable_url && (
                    <button className="btn secondary" style={{ fontSize: 12 }}
                      onClick={() => openFile(s.fichier_livrable_url)}>
                      📄 Ouvrir Livrable PDF
                    </button>
                  )}
                </div>

                {/* Heures retenues */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="field" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
                      Heures retenues *
                    </label>
                    <input className="input" type="number" min={0} step={0.5}
                      style={{ width: 90 }}
                      value={heuresMap[s.id] ?? ''}
                      onChange={e => {
                        const v = e.target.value ? +e.target.value : ''
                        setHeuresMap(m => ({ ...m, [s.id]: v }))
                        if (needsJustif === s.id && v) setNeedsJustif(null)
                      }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--abed-muted)' }}>
                    Montant estimé : <strong>{montantEstimé} FCFA</strong>
                    {' '}(× 1 500 F/h)
                  </span>
                </div>

                {/* Avertissement heures inférieures */}
                {needsJustif === s.id && (
                  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 6 }}>
                      ⚠️ Les heures retenues ({h}) sont inférieures aux heures déclarées ({s.heures_declarees}).
                      Veuillez justifier cet écart.
                    </p>
                    <textarea className="input" rows={2}
                      placeholder="Expliquez pourquoi les heures retenues sont inférieures…"
                      value={justifMap[s.id] ?? ''}
                      onChange={e => setJustifMap(m => ({ ...m, [s.id]: e.target.value }))} />
                  </div>
                )}

                {/* Commentaire pour rejet/correction */}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Commentaire (obligatoire si rejet ou correction)</label>
                  <textarea className="input" rows={2}
                    value={commentMap[s.id] ?? ''}
                    placeholder="Commentaire de rejet ou demande de correction…"
                    onChange={e => setCommentMap(m => ({ ...m, [s.id]: e.target.value }))} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn"
                    style={{ background: '#166534', fontSize: 13 }}
                    disabled={submitting === s.id}
                    onClick={() => valider(s.id)}>
                    ✓ Valider techniquement
                  </button>
                  <button className="btn danger" style={{ fontSize: 13 }}
                    disabled={submitting === s.id}
                    onClick={() => rejeter(s.id, 'corriger_ts')}>
                    Corriger timesheet
                  </button>
                  <button className="btn danger" style={{ fontSize: 13 }}
                    disabled={submitting === s.id}
                    onClick={() => rejeter(s.id, 'corriger_livrable')}>
                    Corriger livrable
                  </button>
                  <button className="btn danger" style={{ fontSize: 13, background: '#7f1d1d' }}
                    disabled={submitting === s.id}
                    onClick={() => rejeter(s.id, 'rejeter')}>
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
