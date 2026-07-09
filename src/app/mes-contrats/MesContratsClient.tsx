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
  signe_employe_le: string | null
  objet: string | null
  articles: { titre: string; contenu: string }[] | null
  commentaires_rh: string | null
  commentaires_employe: string | null
  demande: { id: string; statut: string; fichier_url: string | null } | null
}

type ContratASigner = {
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
  brouillon:          { label: 'Brouillon',              color: '#6b7280', bg: '#f3f4f6', emoji: '📝' },
  envoye_de:          { label: 'En attente de signature de la direction', color: '#6d28d9', bg: '#ede9fe', emoji: '📨' },
  envoye_employe:     { label: 'En attente de votre signature', color: '#b45309', bg: '#fef3c7', emoji: '✍️' },
  signe_employe:      { label: 'Signé — en attente RH', color: '#1e40af', bg: '#dbeafe', emoji: '⏳' },
  envoye_signataire:  { label: 'Chez le signataire',    color: '#6d28d9', bg: '#ede9fe', emoji: '📨' },
  signe_signataire:   { label: 'Signé — en attente finalisation', color: '#065f46', bg: '#d1fae5', emoji: '✅' },
  finalise:           { label: 'Finalisé ✓',             color: '#166534', bg: '#dcfce7', emoji: '🎉' },
  rejete_employe:     { label: 'Renvoyé sans signature — RH informé', color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
  rejete_signataire:  { label: 'En cours de révision par la direction', color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
}

const WORKFLOW_LABELS_SIGNATAIRE: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  envoye_signataire:  { label: 'À signer',                      color: '#b45309', bg: '#fef3c7', emoji: '✍️' },
  signe_signataire:   { label: 'Signé — en attente du RH',      color: '#065f46', bg: '#d1fae5', emoji: '⏳' },
  rejete_signataire:  { label: 'Renvoyé par vous — RH informé', color: '#b91c1c', bg: '#fee2e2', emoji: '↩️' },
  finalise:           { label: 'Finalisé ✓',                    color: '#166534', bg: '#dcfce7', emoji: '🎉' },
}
const DEFAULT_WF = { label: 'En cours', color: '#6b7280', bg: '#f3f4f6', emoji: '📄' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MesContratsClient({ contrats, contratsASigner, canSign }: { contrats: Contrat[]; contratsASigner: ContratASigner[]; canSign: boolean }) {
  const [tab, setTab] = useState<'mine' | 'asigner'>('mine')

  // --- Onglet "Mes contrats" (en tant qu'employé) ---
  const [selected, setSelected] = useState<Contrat | null>(null)
  const [signing, setSigning] = useState(false)
  const [signErr, setSignErr] = useState<string | null>(null)
  const [localContrats, setLocalContrats] = useState<Contrat[]>(contrats)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)
  const [confirmSignId, setConfirmSignId] = useState<string | null>(null)

  // --- Onglet "Contrats à signer" (en tant que signataire de l'organisation) ---
  const [selectedSig, setSelectedSig] = useState<ContratASigner | null>(null)
  const [localASigner, setLocalASigner] = useState<ContratASigner[]>(contratsASigner)
  const [signingSig, setSigningSig] = useState(false)
  const [errSig, setErrSig] = useState<string | null>(null)
  const [confirmSignIdSig, setConfirmSignIdSig] = useState<string | null>(null)
  const [showRefuseFormSig, setShowRefuseFormSig] = useState(false)
  const [motifSig, setMotifSig] = useState('')
  const [refusingSig, setRefusingSig] = useState(false)

  const panelOpen = !!selected || !!confirmSignId || !!selectedSig || !!confirmSignIdSig
  useEffect(() => {
    if (panelOpen) {
      document.body.classList.add('panel-open')
    } else {
      document.body.classList.remove('panel-open')
    }
    return () => document.body.classList.remove('panel-open')
  }, [panelOpen])

  async function signer(id: string) {
    setConfirmSignId(null)
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

  async function signerSignataire(id: string) {
    const c = localASigner.find(x => x.id === id)
    setConfirmSignIdSig(null)
    if (!c?.demande_signature_id) { setErrSig("Ce contrat n'a pas de circuit de signature valide. Contactez le RH."); return }
    setSigningSig(true); setErrSig(null)
    const res = await fetch(`/api/signatures/${c.demande_signature_id}/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const json = await res.json().catch(() => ({}))
    setSigningSig(false)
    if (!res.ok) { setErrSig(json.error ?? 'Erreur lors de la signature'); return }
    setLocalASigner(prev => prev.map(x => x.id === id ? { ...x, workflow_statut: 'signe_signataire' } : x))
    setSelectedSig(prev => prev?.id === id ? { ...prev, workflow_statut: 'signe_signataire' } : prev)
  }

  async function refuserSignataire(id: string) {
    if (motifSig.trim().length < 10) { setErrSig('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusingSig(true); setErrSig(null)
    const res = await fetch(`/api/contrats/${id}/refuser-signataire`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motif: motifSig }),
    })
    const json = await res.json().catch(() => ({}))
    setRefusingSig(false)
    if (!res.ok) { setErrSig(json.error ?? 'Erreur'); return }
    setLocalASigner(prev => prev.map(x => x.id === id ? { ...x, workflow_statut: 'rejete_signataire', commentaires_signataire: motifSig } : x))
    setSelectedSig(prev => prev?.id === id ? { ...prev, workflow_statut: 'rejete_signataire', commentaires_signataire: motifSig } : prev)
    setShowRefuseFormSig(false); setMotifSig('')
  }

  const nbASigner = localASigner.filter(c => c.workflow_statut === 'envoye_signataire').length

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Link href="/accueil" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Accueil</Link>
        <h2 style={{ color: 'var(--abed-green)', margin: '6px 0 0' }}>Mes contrats</h2>
      </div>

      {canSign && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--abed-border)' }}>
          <button
            onClick={() => setTab('mine')}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              background: 'none', border: 'none',
              color: tab === 'mine' ? 'var(--abed-green)' : '#6b7280',
              borderBottom: tab === 'mine' ? '3px solid var(--abed-green)' : '3px solid transparent',
              marginBottom: -1,
            }}
          >
            Mes contrats
          </button>
          <button
            onClick={() => setTab('asigner')}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              background: 'none', border: 'none',
              color: tab === 'asigner' ? 'var(--abed-green)' : '#6b7280',
              borderBottom: tab === 'asigner' ? '3px solid var(--abed-green)' : '3px solid transparent',
              marginBottom: -1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            Contrats à signer
            {nbASigner > 0 && (
              <span style={{ background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{nbASigner}</span>
            )}
          </button>
        </div>
      )}

      {tab === 'mine' ? (
        localContrats.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucun contrat établi pour le moment.</p>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--abed-muted)', fontSize: 13, margin: '0 0 12px' }}>
              {localContrats.length} document{localContrats.length > 1 ? 's' : ''} contractuel{localContrats.length > 1 ? 's' : ''}
            </p>
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
                          onClick={e => { e.stopPropagation(); setConfirmSignId(c.id) }}
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
          </>
        )
      ) : (
        localASigner.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✍️</div>
            <p style={{ color: 'var(--abed-muted)', fontSize: 15 }}>Aucun contrat à signer pour le moment.</p>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--abed-muted)', fontSize: 13, margin: '0 0 12px' }}>
              Contrats et documents à signer en tant que représentant de l&apos;organisation.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              {localASigner.map(c => {
                const wf = WORKFLOW_LABELS_SIGNATAIRE[c.workflow_statut ?? ''] ?? DEFAULT_WF
                const needsAction = c.workflow_statut === 'envoye_signataire'
                const nomEmploye = `${c.profile?.prenoms ?? ''} ${c.profile?.nom ?? ''}`.trim() || '—'
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedSig(c)}
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
                          onClick={e => { e.stopPropagation(); setSelectedSig(c) }}
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
          </>
        )
      )}

      {/* Panneau détail — Mes contrats */}
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
                    onClick={() => setConfirmSignId(selected.id)}
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

      {/* Confirmation de signature — Mes contrats */}
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
              Confirmer votre signature électronique sur ce contrat ?
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

      {/* Panneau détail — Contrats à signer (lecture intégrale + actions) */}
      {selectedSig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setSelectedSig(null); setShowRefuseFormSig(false); setMotifSig(''); setErrSig(null) }}>
          <div
            style={{ background: 'white', width: '100%', maxWidth: 1100, height: '90vh', borderRadius: 14, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'row' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Contenu du contrat */}
            <div style={{ flex: 1, minWidth: 0, background: '#f3f4f6', overflow: 'hidden' }}>
              <iframe
                src={`/api/contrat-pdf/${selectedSig.id}`}
                title={`${selectedSig.categorie_document ?? 'Contrat'} ${selectedSig.type_contrat}`}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>

            {/* Colonne actions */}
            <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid #e5e7eb', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{selectedSig.numero ?? '—'}</div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 17, color: '#111827' }}>
                    {selectedSig.categorie_document ?? 'Contrat'} {selectedSig.type_contrat}
                  </h3>
                </div>
                <button onClick={() => { setSelectedSig(null); setShowRefuseFormSig(false); setMotifSig(''); setErrSig(null) }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
              </div>

              {(() => {
                const wf = WORKFLOW_LABELS_SIGNATAIRE[selectedSig.workflow_statut ?? ''] ?? DEFAULT_WF
                return (
                  <div style={{ background: wf.bg, border: `1px solid ${wf.color}30`, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: wf.color }}>{wf.emoji} {wf.label}</span>
                  </div>
                )
              })()}

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Employé', `${selectedSig.profile?.prenoms ?? ''} ${selectedSig.profile?.nom ?? ''}`.trim() || '—'],
                    ['Poste', selectedSig.poste ?? '—'],
                    ['Direction', selectedSig.direction ?? '—'],
                    ['Début', fmtDate(selectedSig.date_debut)],
                    ['Fin', fmtDate(selectedSig.date_fin)],
                  ].map(([l, v]) => (
                    <tr key={l} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 0', fontSize: 12.5, color: '#6b7280', width: 90 }}>{l}</td>
                      <td style={{ padding: '6px 0', fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedSig.commentaires_rh && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>NOTE DU RH</div>
                  <p style={{ fontSize: 12.5, color: '#1e3a8a', margin: 0 }}>{selectedSig.commentaires_rh}</p>
                </div>
              )}

              {selectedSig.commentaires_employe && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>NOTE DE L&apos;EMPLOYÉ</div>
                  <p style={{ fontSize: 12.5, color: '#374151', margin: 0 }}>{selectedSig.commentaires_employe}</p>
                </div>
              )}

              {selectedSig.workflow_statut === 'rejete_signataire' && selectedSig.commentaires_signataire && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>VOTRE MOTIF DE RENVOI</div>
                  <p style={{ fontSize: 12.5, color: '#991b1b', margin: 0 }}>{selectedSig.commentaires_signataire}</p>
                </div>
              )}

              {selectedSig.workflow_statut === 'envoye_signataire' && showRefuseFormSig && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
                    Motif du renvoi * (min. 10 caractères)
                  </label>
                  <textarea
                    value={motifSig} onChange={e => setMotifSig(e.target.value)} rows={4}
                    placeholder="Précisez les corrections à apporter avant de signer..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => refuserSignataire(selectedSig.id)} disabled={refusingSig}
                      style={{ flex: 1, background: '#b91c1c', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {refusingSig ? 'Envoi…' : 'Confirmer le renvoi au RH'}
                    </button>
                    <button onClick={() => { setShowRefuseFormSig(false); setMotifSig(''); setErrSig(null) }}
                      style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', fontSize: 13, cursor: 'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {errSig && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{errSig}</p>}

              {selectedSig.workflow_statut === 'envoye_signataire' && !showRefuseFormSig && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => setConfirmSignIdSig(selectedSig.id)}
                    disabled={signingSig}
                    style={{ background: 'var(--abed-green)', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {signingSig ? 'Signature en cours…' : '✍️ Signer ce contrat'}
                  </button>
                  <button
                    onClick={() => { setShowRefuseFormSig(true); setErrSig(null) }}
                    style={{ background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↩️ Renvoyer au RH sans signer
                  </button>
                </div>
              )}

              <a
                href={`/api/contrat-pdf/${selectedSig.id}`}
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

      {/* Confirmation de signature — Contrats à signer */}
      {confirmSignIdSig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmSignIdSig(null)}>
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
              <button onClick={() => setConfirmSignIdSig(null)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--abed-border)', background: 'white', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => signerSignataire(confirmSignIdSig)} disabled={signingSig}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--abed-green)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {signingSig ? 'Signature…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
