'use client'
import { useState } from 'react'
import Link from 'next/link'

type Contrat = {
  id: string
  numero: string | null
  type_contrat: string
  categorie_document: string | null
  poste: string | null
  direction: string | null
  date_debut: string
  date_fin: string | null
  statut: string
  workflow_statut: string | null
  signe_employe_le: string | null
  objet: string | null
  articles: { titre: string; contenu: string }[] | null
  commentaires_rh: string | null
  commentaires_employe: string | null
  demande: { id: string; statut: string; fichier_url: string | null } | null
}

const WORKFLOW_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  brouillon:          { label: 'Brouillon',              color: '#6b7280', bg: '#f3f4f6', emoji: '📝' },
  envoye_employe:     { label: 'En attente de votre signature', color: '#b45309', bg: '#fef3c7', emoji: '✍️' },
  signe_employe:      { label: 'Signé — en attente RH', color: '#1e40af', bg: '#dbeafe', emoji: '⏳' },
  envoye_signataire:  { label: 'Chez le signataire',    color: '#6d28d9', bg: '#ede9fe', emoji: '📨' },
  signe_signataire:   { label: 'Signé — en attente finalisation', color: '#065f46', bg: '#d1fae5', emoji: '✅' },
  finalise:           { label: 'Finalisé ✓',             color: '#166534', bg: '#dcfce7', emoji: '🎉' },
  rejete_employe:     { label: 'Renvoyé sans signature — RH informé', color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
  rejete_signataire:  { label: 'En cours de révision par la direction', color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MesContratsClient({ contrats }: { contrats: Contrat[] }) {
  const [selected, setSelected] = useState<Contrat | null>(null)
  const [signing, setSigning] = useState(false)
  const [signErr, setSignErr] = useState<string | null>(null)
  const [localContrats, setLocalContrats] = useState<Contrat[]>(contrats)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)

  async function signer(id: string) {
    if (!confirm('Confirmer votre signature électronique sur ce contrat ?')) return
    setSigning(true); setSignErr(null)
    const res = await fetch(`/api/contrats/${id}/signer-employe`, { method: 'POST' })
    const json = await res.json()
    setSigning(false)
    if (!res.ok) { setSignErr(json.error ?? 'Erreur'); return }
    setLocalContrats(prev => prev.map(c => c.id === id ? { ...c, workflow_statut: 'signe_employe', signe_employe_le: new Date().toISOString() } : c))
    setSelected(prev => prev?.id === id ? { ...prev, workflow_statut: 'signe_employe', signe_employe_le: new Date().toISOString() } : prev)
  }

  async function refuser(id: string) {
    if (motif.trim().length < 10) { setSignErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusing(true); setSignErr(null)
    const res = await fetch(`/api/contrats/${id}/refuser-employe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motif }),
    })
    const json = await res.json()
    setRefusing(false)
    if (!res.ok) { setSignErr(json.error ?? 'Erreur'); return }
    setLocalContrats(prev => prev.map(c => c.id === id ? { ...c, workflow_statut: 'rejete_employe' } : c))
    setSelected(prev => prev?.id === id ? { ...prev, workflow_statut: 'rejete_employe' } : prev)
    setShowRefuseForm(false); setMotif('')
  }

  if (localContrats.length === 0) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: 24 }}>
          <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
          <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Mes contrats</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucun contrat établi pour le moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Mes contrats</h2>
        <p style={{ color: 'var(--abed-muted)', fontSize: 13, margin: '4px 0 0' }}>
          {localContrats.length} document{localContrats.length > 1 ? 's' : ''} contractuel{localContrats.length > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {localContrats.map(c => {
          const wf = WORKFLOW_LABELS[c.workflow_statut ?? 'envoye_employe'] ?? WORKFLOW_LABELS['envoye_employe']
          const needsSignature = c.workflow_statut === 'envoye_employe'
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                background: 'white', border: `2px solid ${needsSignature ? '#fcd34d' : '#e5e7eb'}`,
                borderRadius: 12, padding: '18px 22px', cursor: 'pointer',
                boxShadow: needsSignature ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = needsSignature ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.06)')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>{c.numero ?? '—'}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: wf.bg, color: wf.color,
                  }}>{wf.emoji} {wf.label}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                  {c.categorie_document ?? 'Contrat'} {c.type_contrat}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {c.poste ?? '—'} · Du {fmtDate(c.date_debut)}{c.date_fin ? ` au ${fmtDate(c.date_fin)}` : ' (CDI)'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {needsSignature && (
                  <button
                    onClick={e => { e.stopPropagation(); signer(c.id) }}
                    disabled={signing}
                    style={{
                      background: '#b45309', color: 'white', border: 'none',
                      borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ✍️ Signer
                  </button>
                )}
                <span style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, alignSelf: 'center' }}>Voir →</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Panneau détail */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
          onClick={() => setSelected(null)}>
          <div
            style={{ background: 'white', width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,.12)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{selected.numero ?? '—'}</div>
                <h3 style={{ margin: '4px 0 0', fontSize: 18, color: '#111827' }}>
                  {selected.categorie_document ?? 'Contrat'} {selected.type_contrat}
                </h3>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>

            {/* Statut workflow */}
            {(() => {
              const wf = WORKFLOW_LABELS[selected.workflow_statut ?? 'envoye_employe']
              return (
                <div style={{ background: wf.bg, border: `1px solid ${wf.color}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: wf.color }}>{wf.emoji} {wf.label}</span>
                </div>
              )
            })()}

            {/* Infos */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <tbody>
                {[
                  ['Poste', selected.poste ?? '—'],
                  ['Direction', selected.direction ?? '—'],
                  ['Date de début', fmtDate(selected.date_debut)],
                  ['Date de fin', fmtDate(selected.date_fin)],
                  ['Signé le', fmtDate(selected.signe_employe_le)],
                ].map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 0', fontSize: 13, color: '#6b7280', width: 140 }}>{l}</td>
                    <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 600, color: '#111827' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Objet */}
            {selected.objet && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>OBJET</div>
                <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>{selected.objet}</p>
              </div>
            )}

            {/* Articles */}
            {selected.articles && selected.articles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>ARTICLES</div>
                {selected.articles.map((art, i) => (
                  <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{art.titre}</div>
                    <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{art.contenu}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Commentaire RH */}
            {selected.commentaires_rh && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>NOTE DU RH</div>
                <p style={{ fontSize: 13, color: '#1e3a8a', margin: 0 }}>{selected.commentaires_rh}</p>
              </div>
            )}

            {/* Renvoyer sans signer */}
            {selected.workflow_statut === 'envoye_employe' && showRefuseForm && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
                  Motif du renvoi * (min. 10 caractères)
                </label>
                <textarea
                  value={motif} onChange={e => setMotif(e.target.value)} rows={3}
                  placeholder="Expliquez les corrections à apporter avant de signer..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => refuser(selected.id)} disabled={refusing}
                    style={{ flex: 1, background: '#b91c1c', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {refusing ? 'Envoi…' : 'Confirmer le renvoi au RH'}
                  </button>
                  <button onClick={() => { setShowRefuseForm(false); setMotif(''); setSignErr(null) }}
                    style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {signErr && <p style={{ color: '#ef4444', fontSize: 13 }}>{signErr}</p>}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {selected.workflow_statut === 'envoye_employe' && !showRefuseForm && (
                <>
                  <button
                    onClick={() => signer(selected.id)}
                    disabled={signing}
                    style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {signing ? 'Signature en cours…' : '✍️ Signer ce contrat'}
                  </button>
                  <button
                    onClick={() => { setShowRefuseForm(true); setSignErr(null) }}
                    style={{ background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↩️ Renvoyer sans signer
                  </button>
                </>
              )}
              <a
                href={`/api/contrat-pdf/${selected.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', textAlign: 'center', background: '#f3f4f6', color: '#374151', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
              >
                📄 Voir / télécharger le document (PDF)
              </a>
              {selected.demande?.fichier_url && (
                <Link
                  href={`/signatures/${selected.demande.id}/view`}
                  style={{ display: 'block', textAlign: 'center', background: '#f3f4f6', color: '#374151', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
                >
                  📄 Voir le document signé
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
