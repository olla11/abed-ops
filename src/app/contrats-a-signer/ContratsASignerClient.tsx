'use client'
import { useState, useEffect } from 'react'
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
  objet: string | null
  commentaires_rh: string | null
  commentaires_employe: string | null
  commentaires_signataire: string | null
  demande_signature_id: string | null
  profile: { nom: string; prenoms: string } | null
}

const WORKFLOW_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  envoye_signataire:  { label: 'À signer',                         color: '#b45309', bg: '#fef3c7', emoji: '✍️' },
  signe_signataire:   { label: 'Signé — en attente du RH',         color: '#065f46', bg: '#d1fae5', emoji: '⏳' },
  rejete_signataire:  { label: 'Renvoyé par vous — RH informé',    color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
  finalise:           { label: 'Finalisé ✓',                       color: '#166534', bg: '#dcfce7', emoji: '🎉' },
}
const DEFAULT_WF = { label: 'En cours', color: '#6b7280', bg: '#f3f4f6', emoji: '📄' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ContratsASignerClient({ contrats }: { contrats: Contrat[] }) {
  const [selected, setSelected] = useState<Contrat | null>(null)
  const [localContrats, setLocalContrats] = useState<Contrat[]>(contrats)
  const [signing, setSigning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmSignId, setConfirmSignId] = useState<string | null>(null)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)

  useEffect(() => {
    if (selected || confirmSignId) {
      document.body.classList.add('panel-open')
    } else {
      document.body.classList.remove('panel-open')
    }
    return () => document.body.classList.remove('panel-open')
  }, [selected, confirmSignId])

  async function signer(id: string) {
    const c = localContrats.find(x => x.id === id)
    setConfirmSignId(null)
    if (!c?.demande_signature_id) { setErr("Ce contrat n'a pas de circuit de signature valide. Contactez le RH."); return }
    setSigning(true); setErr(null)
    const res = await fetch(`/api/signatures/${c.demande_signature_id}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const json = await res.json().catch(() => ({}))
    setSigning(false)
    if (!res.ok) { setErr(json.error ?? 'Erreur lors de la signature'); return }
    setLocalContrats(prev => prev.map(x => x.id === id ? { ...x, workflow_statut: 'signe_signataire' } : x))
    setSelected(prev => prev?.id === id ? { ...prev, workflow_statut: 'signe_signataire' } : prev)
  }

  async function refuser(id: string) {
    if (motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusing(true); setErr(null)
    const res = await fetch(`/api/contrats/${id}/refuser-signataire`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motif }),
    })
    const json = await res.json().catch(() => ({}))
    setRefusing(false)
    if (!res.ok) { setErr(json.error ?? 'Erreur'); return }
    setLocalContrats(prev => prev.map(x => x.id === id ? { ...x, workflow_statut: 'rejete_signataire', commentaires_signataire: motif } : x))
    setSelected(prev => prev?.id === id ? { ...prev, workflow_statut: 'rejete_signataire', commentaires_signataire: motif } : prev)
    setShowRefuseForm(false); setMotif('')
  }

  if (localContrats.length === 0) {
    return (
      <div className="page-container">
        <div style={{ marginBottom: 24 }}>
          <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
          <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Contrats à signer</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✍️</div>
          <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucun contrat à signer pour le moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Contrats à signer</h2>
        <p style={{ color: 'var(--abed-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Contrats et documents que vous devez signer en tant que représentant de l&apos;organisation.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {localContrats.map(c => {
          const wf = WORKFLOW_LABELS[c.workflow_statut ?? ''] ?? DEFAULT_WF
          const needsAction = c.workflow_statut === 'envoye_signataire'
          const nomEmploye = `${c.profile?.prenoms ?? ''} ${c.profile?.nom ?? ''}`.trim() || '—'
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                background: 'white', border: `2px solid ${needsAction ? '#fcd34d' : '#e5e7eb'}`,
                borderRadius: 12, padding: '18px 22px', cursor: 'pointer',
                boxShadow: needsAction ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = needsAction ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.06)')}
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
                  {c.categorie_document ?? 'Contrat'} {c.type_contrat} — {nomEmploye}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {c.poste ?? '—'} · Du {fmtDate(c.date_debut)}{c.date_fin ? ` au ${fmtDate(c.date_fin)}` : ' (CDI)'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {needsAction && (
                  <button
                    onClick={e => { e.stopPropagation(); setSelected(c) }}
                    style={{
                      background: '#b45309', color: 'white', border: 'none',
                      borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    📄 Lire et signer
                  </button>
                )}
                <span style={{ fontSize: 13, color: 'var(--abed-green)', fontWeight: 600, alignSelf: 'center' }}>Voir →</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Panneau détail : lecture du contrat + actions */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setSelected(null); setShowRefuseForm(false); setMotif(''); setErr(null) }}>
          <div
            style={{ background: 'white', width: '100%', maxWidth: 1100, height: '90vh', borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'row' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Contenu du contrat */}
            <div style={{ flex: 1, minWidth: 0, background: '#f3f4f6', overflow: 'hidden' }}>
              <iframe
                src={`/api/contrat-pdf/${selected.id}`}
                title={`${selected.categorie_document ?? 'Contrat'} ${selected.type_contrat}`}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>

            {/* Colonne actions */}
            <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid #e5e7eb', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{selected.numero ?? '—'}</div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 17, color: '#111827' }}>
                    {selected.categorie_document ?? 'Contrat'} {selected.type_contrat}
                  </h3>
                </div>
                <button onClick={() => { setSelected(null); setShowRefuseForm(false); setMotif(''); setErr(null) }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
              </div>

              {(() => {
                const wf = WORKFLOW_LABELS[selected.workflow_statut ?? ''] ?? DEFAULT_WF
                return (
                  <div style={{ background: wf.bg, border: `1px solid ${wf.color}30`, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: wf.color }}>{wf.emoji} {wf.label}</span>
                  </div>
                )
              })()}

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Employé', `${selected.profile?.prenoms ?? ''} ${selected.profile?.nom ?? ''}`.trim() || '—'],
                    ['Poste', selected.poste ?? '—'],
                    ['Direction', selected.direction ?? '—'],
                    ['Début', fmtDate(selected.date_debut)],
                    ['Fin', fmtDate(selected.date_fin)],
                  ].map(([l, v]) => (
                    <tr key={l} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 0', fontSize: 12.5, color: '#6b7280', width: 90 }}>{l}</td>
                      <td style={{ padding: '6px 0', fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selected.commentaires_rh && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>NOTE DU RH</div>
                  <p style={{ fontSize: 12.5, color: '#1e3a8a', margin: 0 }}>{selected.commentaires_rh}</p>
                </div>
              )}

              {selected.commentaires_employe && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>NOTE DE L&apos;EMPLOYÉ</div>
                  <p style={{ fontSize: 12.5, color: '#374151', margin: 0 }}>{selected.commentaires_employe}</p>
                </div>
              )}

              {selected.workflow_statut === 'rejete_signataire' && selected.commentaires_signataire && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>VOTRE MOTIF DE RENVOI</div>
                  <p style={{ fontSize: 12.5, color: '#991b1b', margin: 0 }}>{selected.commentaires_signataire}</p>
                </div>
              )}

              {selected.workflow_statut === 'envoye_signataire' && showRefuseForm && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
                    Motif du renvoi * (min. 10 caractères)
                  </label>
                  <textarea
                    value={motif} onChange={e => setMotif(e.target.value)} rows={4}
                    placeholder="Précisez les corrections à apporter avant de signer..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => refuser(selected.id)} disabled={refusing}
                      style={{ flex: 1, background: '#b91c1c', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {refusing ? 'Envoi…' : 'Confirmer le renvoi au RH'}
                    </button>
                    <button onClick={() => { setShowRefuseForm(false); setMotif(''); setErr(null) }}
                      style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {err && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{err}</p>}

              {selected.workflow_statut === 'envoye_signataire' && !showRefuseForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => setConfirmSignId(selected.id)}
                    disabled={signing}
                    style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {signing ? 'Signature en cours…' : '✍️ Signer ce contrat'}
                  </button>
                  <button
                    onClick={() => { setShowRefuseForm(true); setErr(null) }}
                    style={{ background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↩️ Renvoyer au RH sans signer
                  </button>
                </div>
              )}

              <a
                href={`/api/contrat-pdf/${selected.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', textAlign: 'center', background: '#f3f4f6', color: '#374151', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                📄 Ouvrir dans un nouvel onglet
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de signature */}
      {confirmSignId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmSignId(null)}>
          <div
            style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>✍️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#111827', textAlign: 'center' }}>Confirmer la signature</h3>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '0 0 22px' }}>
              Confirmer votre signature électronique sur ce contrat, au nom de l&apos;organisation ?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmSignId(null)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => signer(confirmSignId)} disabled={signing}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--abed-green)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {signing ? 'Signature…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
