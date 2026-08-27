'use client'
import { useState } from 'react'

type Article = { titre: string; contenu: string }

type Contrat = {
  id: string
  numero: string | null
  categorieDocument: string | null
  typeContrat: string
  poste: string | null
  direction: string | null
  dateDebut: string
  dateFin: string | null
  objet: string | null
  articles: Article[]
  workflowStatut: string | null
  signeLe: string | null
  commentairesRh: string | null
  commentairesDestinataire: string | null
  destinatairePrenoms: string | null
  destinataireNom: string | null
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const shellStyle: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9' }
const cardStyle: React.CSSProperties = { background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }

export default function ContratExterneClient({ token, contrat: initial }: { token: string; contrat: Contrat }) {
  const [contrat, setContrat] = useState(initial)
  const [prenoms, setPrenoms] = useState('')
  const [nom, setNom] = useState('')
  const [savingNom, setSavingNom] = useState(false)
  const [nomErr, setNomErr] = useState<string | null>(null)

  const [confirmSign, setConfirmSign] = useState(false)
  const [signing, setSigning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [motif, setMotif] = useState('')
  const [refusing, setRefusing] = useState(false)

  const pdfUrl = `/api/contrat-pdf/${contrat.id}?t=${encodeURIComponent(token)}`

  async function submitNom() {
    if (!prenoms.trim() || !nom.trim()) { setNomErr('Prénom et nom sont requis.'); return }
    setSavingNom(true); setNomErr(null)
    try {
      const res = await fetch('/api/contrats/externe/nom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, prenoms: prenoms.trim(), nom: nom.trim() }),
      })
      const d = await res.json()
      if (res.ok) setContrat(c => ({ ...c, destinatairePrenoms: d.prenoms, destinataireNom: d.nom }))
      else setNomErr(d.error ?? 'Erreur')
    } catch { setNomErr('Erreur réseau') }
    finally { setSavingNom(false) }
  }

  async function signer() {
    setConfirmSign(false)
    setSigning(true); setErr(null)
    try {
      const res = await fetch('/api/contrats/externe/sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      setContrat(c => ({ ...c, workflowStatut: d.workflow_statut, signeLe: new Date().toISOString() }))
    } catch { setErr('Erreur réseau') }
    finally { setSigning(false) }
  }

  async function refuser() {
    if (motif.trim().length < 10) { setErr('Le motif est obligatoire (minimum 10 caractères).'); return }
    setRefusing(true); setErr(null)
    try {
      const res = await fetch('/api/contrats/externe/refuse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, motif }),
      })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      setContrat(c => ({ ...c, workflowStatut: 'rejete_employe', commentairesDestinataire: motif }))
      setShowRefuseForm(false); setMotif('')
    } catch { setErr('Erreur réseau') }
    finally { setRefusing(false) }
  }

  // ── États terminaux ──
  if (contrat.signeLe || contrat.workflowStatut === 'finalise') {
    return (
      <div style={shellStyle}>
        <div style={{ ...cardStyle, maxWidth: 520 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#166534', marginBottom: 8, fontSize: 20 }}>Document signé avec succès !</h2>
          <p style={{ color: '#374151', fontSize: 14 }}>
            Vous avez signé <strong>{contrat.categorieDocument ?? 'le document'} {contrat.typeContrat}</strong>
            {contrat.signeLe ? ` le ${fmtDate(contrat.signeLe)}` : ''}.
          </p>
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, background: 'white', color: '#166534', border: '1px solid #86efac', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%', textDecoration: 'none', boxSizing: 'border-box' }}>
            📥 Télécharger le document
          </a>
        </div>
      </div>
    )
  }

  if (contrat.workflowStatut === 'rejete_employe') {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>↩️</div>
          <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Document renvoyé</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>La RH d&apos;ABED ONG a été informée de votre motif et vous recontactera après correction du document.</p>
        </div>
      </div>
    )
  }

  if (contrat.workflowStatut !== 'envoye_employe' && contrat.workflowStatut !== 'brouillon') {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>ℹ️</div>
          <h2 style={{ color: '#111827', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Document non disponible</h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Ce document n&apos;est pas (ou plus) en attente de votre action.</p>
        </div>
      </div>
    )
  }

  // ── Étape 1 : capturer le nom et prénom ──
  if (!contrat.destinatairePrenoms || !contrat.destinataireNom) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <h2 style={{ color: '#111827', fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>
            {contrat.categorieDocument ?? 'Document'} — {contrat.typeContrat}
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            ABED ONG vous a envoyé ce document. Avant de le consulter et d&apos;y répondre, indiquez votre nom et prénom.
          </p>
          <div style={{ textAlign: 'left', marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Prénom(s) *</label>
            <input value={prenoms} onChange={e => setPrenoms(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1px solid #e5e7eb', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {nomErr && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b', marginBottom: 14, textAlign: 'left' }}>{nomErr}</div>}
          <button onClick={submitNom} disabled={savingNom}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#16a34a', color: 'white', border: 'none', cursor: savingNom ? 'not-allowed' : 'pointer', opacity: savingNom ? 0.7 : 1 }}>
            {savingNom ? 'Enregistrement...' : 'Continuer →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Étape 2 : consulter et répondre ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f4f6f9' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{contrat.numero ?? '—'}</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18, color: '#111827' }}>{contrat.categorieDocument ?? 'Document'} {contrat.typeContrat}</h2>
          </div>
          <span style={{ fontSize: 13, color: '#374151' }}>Bonjour {contrat.destinatairePrenoms} {contrat.destinataireNom}</span>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: 20, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 320, background: '#e5e7eb', borderRadius: 12, overflow: 'hidden', minHeight: 480 }}>
          <iframe src={pdfUrl} title="Document" style={{ width: '100%', height: '100%', minHeight: 480, border: 'none', display: 'block' }} />
        </div>

        <div style={{ flex: '0 0 340px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, padding: 4 }}>
            <tbody>
              {[
                ['Poste', contrat.poste ?? '—'],
                ['Direction', contrat.direction ?? '—'],
                ['Date de début', fmtDate(contrat.dateDebut)],
                ['Date de fin', fmtDate(contrat.dateFin)],
              ].map(([l, v]) => (
                <tr key={l} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, color: '#6b7280' }}>{l}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#111827', textAlign: 'right' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {contrat.commentairesRh && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>NOTE D&apos;ABED ONG</div>
              <p style={{ fontSize: 12.5, color: '#1e3a8a', margin: 0 }}>{contrat.commentairesRh}</p>
            </div>
          )}

          {showRefuseForm && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: 6 }}>
                Motif / commentaire * (min. 10 caractères)
              </label>
              <textarea
                value={motif} onChange={e => setMotif(e.target.value)} rows={4}
                placeholder="Expliquez pourquoi vous ne signez pas, ou ajoutez vos remarques sur le document..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          )}

          {err && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c0392b' }}>{err}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!showRefuseForm && (
              <>
                <button onClick={() => setConfirmSign(true)} disabled={signing}
                  style={{ background: 'var(--abed-green, #16a34a)', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {signing ? 'Signature en cours…' : '✍️ Signer ce document'}
                </button>
                <button onClick={() => { setShowRefuseForm(true); setErr(null) }}
                  style={{ background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ↩️ Refuser / commenter sans signer
                </button>
              </>
            )}
            {showRefuseForm && (
              <>
                <button onClick={refuser} disabled={refusing}
                  style={{ background: '#b91c1c', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {refusing ? 'Envoi…' : 'Envoyer sans signer'}
                </button>
                <button onClick={() => { setShowRefuseForm(false); setMotif(''); setErr(null) }}
                  style={{ background: 'white', border: '1px solid var(--abed-border, #e5e7eb)', borderRadius: 10, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
                  Annuler
                </button>
              </>
            )}
            <a href={pdfUrl} target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', background: '#f3f4f6', color: '#374151', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              📄 Ouvrir dans un nouvel onglet
            </a>
          </div>
        </div>
      </div>

      {confirmSign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmSign(false)}>
          <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>✍️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#111827', textAlign: 'center' }}>Confirmer la signature</h3>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', margin: '0 0 22px' }}>
              Confirmer votre signature électronique en tant que <strong>{contrat.destinatairePrenoms} {contrat.destinataireNom}</strong> ?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmSign(false)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={signer} disabled={signing}
                style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {signing ? 'Signature…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
