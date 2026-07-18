'use client'
import { useState, useRef } from 'react'
import type { DemandeRow, ProfileOption, SignataireRow } from './page'
import Pagination, { paginate, PAGE_SIZE } from '@/components/Pagination'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid var(--abed-border)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4,
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SignataireChip({ s }: { s: SignataireRow }) {
  const name = s.profile
    ? `${s.profile.prenoms} ${s.profile.nom}`
    : (s.nom_externe || s.email || s.profile_id || 'Signataire')
  const isExterne = !s.profile_id
  const bg = s.refuse ? '#fee2e2' : s.signe ? '#dcfce7' : '#fef3c7'
  const color = s.refuse ? '#991b1b' : s.signe ? '#166534' : '#92400e'
  const border = s.refuse ? '#fca5a5' : s.signe ? '#86efac' : '#fde68a'
  const icone = s.refuse ? '✕' : s.signe ? '✓' : '⏳'
  return (
    <span
      title={s.refuse ? s.refuse_motif ?? undefined : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        background: bg, color, border: `1px solid ${border}`,
      }}>
      {icone} {name}{isExterne && <span title="Signataire externe" style={{ fontWeight: 400 }}> (externe)</span>}
      {s.signe && s.signe_le && <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>· {fmtDate(s.signe_le)}</span>}
      {s.refuse && s.refuse_le && <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>· {fmtDate(s.refuse_le)}</span>}
    </span>
  )
}

function DemandeCard({ d, userId, onDeleted, onCorrected }: { d: DemandeRow; userId: string; onDeleted: (id: string) => void; onCorrected: (demande: DemandeRow) => void }) {
  const [err, setErr] = useState<string | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showCorrigerModal, setShowCorrigerModal] = useState(false)
  const [correctionFichier, setCorrectionFichier] = useState<File | null>(null)
  const [correctionErr, setCorrectionErr] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const correctionFileRef = useRef<HTMLInputElement>(null)
  const createur = d.createur ? `${d.createur.prenoms} ${d.createur.nom}` : '—'
  const myEntry = d.signataires.find(s => s.profile_id === userId)
  const canSign = !!myEntry && !myEntry.signe && d.statut === 'en_attente'
  const canDelete = d.createur_id === userId
  const signed = d.signataires.filter(s => s.signe).length
  const total = d.signataires.length
  const refusePar = d.signataires.find(s => s.refuse)
  const refuseParNom = refusePar ? (refusePar.profile ? `${refusePar.profile.prenoms} ${refusePar.profile.nom}` : (refusePar.nom_externe || refusePar.email || 'Un signataire')) : null

  async function submitCorrection() {
    if (!correctionFichier) { setCorrectionErr('Joignez le document corrigé.'); return }
    setCorrecting(true); setCorrectionErr(null)
    const fd = new FormData()
    fd.append('fichier', correctionFichier)
    const res = await fetch(`/api/signatures/${d.id}/renvoyer`, { method: 'POST', body: fd })
    setCorrecting(false)
    if (res.ok) {
      const data = await res.json()
      if (data.demande) onCorrected(data.demande)
      setShowCorrigerModal(false)
      setCorrectionFichier(null)
      if (correctionFileRef.current) correctionFileRef.current.value = ''
    } else {
      const data = await res.json().catch(() => ({}))
      setCorrectionErr(data.error ?? 'Erreur lors du renvoi')
    }
  }

  function armDelete() {
    setDeleteArmed(true)
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = setTimeout(() => setDeleteArmed(false), 4000)
  }

  async function confirmDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    setDeleting(true); setErr(null)
    const res = await fetch(`/api/signatures/${d.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      onDeleted(d.id)
    } else {
      const data = await res.json().catch(() => ({}))
      setErr(data.error ?? 'Erreur lors de la suppression')
      setDeleteArmed(false)
    }
  }

  return (
    <div style={{
      background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10,
      padding: '18px 22px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{d.titre}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
              background: d.statut === 'complete' ? '#dcfce7' : d.statut === 'refusee' ? '#fee2e2' : '#fef3c7',
              color: d.statut === 'complete' ? '#166534' : d.statut === 'refusee' ? '#991b1b' : '#92400e',
            }}>
              {d.statut === 'complete' ? 'Complet' : d.statut === 'refusee' ? 'Refusé' : 'En attente'}
            </span>
          </div>
          {d.description && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>{d.description}</p>
          )}
          {d.statut === 'refusee' && refusePar && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#991b1b' }}>
              <strong>{refuseParNom}</strong> a refusé de signer : {refusePar.refuse_motif}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>
              Créé par <strong style={{ color: '#374151' }}>{createur}</strong> · {fmtDate(d.created_at)}
              {d.fichier_url && (
                <> · <a href={`/signatures/${d.id}/view`} style={{ color: 'var(--abed-green)', fontWeight: 600 }}>📄 Voir le document</a></>
              )}
            </span>
            {canDelete && d.statut === 'refusee' && (
              <button onClick={() => { setShowCorrigerModal(true); setCorrectionErr(null) }}
                style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}>
                📤 Corriger et renvoyer
              </button>
            )}
            {canDelete && (
              deleteArmed ? (
                <button onClick={confirmDelete} disabled={deleting}
                  style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, cursor: deleting ? 'not-allowed' : 'pointer', background: '#dc2626', color: 'white', border: 'none', opacity: deleting ? 0.7 : 1 }}>
                  {deleting ? 'Suppression...' : 'Confirmer la suppression ?'}
                </button>
              ) : (
                <button onClick={armDelete}
                  style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, cursor: 'pointer', background: 'white', color: '#6b7280', border: '1px solid var(--abed-border)' }}>
                  🗑️ Supprimer
                </button>
              )
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {d.signataires.map(s => <SignataireChip key={s.profile_id ?? s.email} s={s} />)}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {signed}/{total} signataire{total > 1 ? 's' : ''} ont signé
          </div>
        </div>
        {canSign && (
          <div style={{ flexShrink: 0 }}>
            <a
              href={`/signatures/${d.id}/signer`}
              style={{
                display: 'inline-block',
                padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
              }}
            >
              📄 Ouvrir (signer ou refuser)
            </a>
            {err && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 6 }}>{err}</div>}
          </div>
        )}
      </div>

      {showCorrigerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 26, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginBottom: 6, fontSize: 16, color: '#111827' }}>Corriger et renvoyer</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              Joignez la version corrigée du document. Tous les signataires seront réinitialisés et notifiés pour signer à nouveau.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Document corrigé (PDF) *</label>
              <input
                ref={correctionFileRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => setCorrectionFichier(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: '6px 10px' }}
              />
              {correctionFichier && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📄 {correctionFichier.name}</div>}
            </div>
            {correctionErr && (
              <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>
                {correctionErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCorrigerModal(false); setCorrectionErr(null) }}
                style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={submitCorrection}
                disabled={correcting}
                style={{
                  padding: '9px 20px', borderRadius: 8, cursor: correcting ? 'not-allowed' : 'pointer',
                  background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700,
                  opacity: correcting ? 0.7 : 1,
                }}
              >
                {correcting ? 'Envoi...' : 'Renvoyer pour signature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Props = {
  userId: string
  mesDemandesASign: DemandeRow[]
  mesCreations: DemandeRow[]
  toutesSignees: DemandeRow[]
  profiles: ProfileOption[]
}

export default function SignaturesClient({ userId, mesDemandesASign: initialASign, mesCreations: initialCreations, toutesSignees, profiles }: Props) {
  const [activeTab, setActiveTab] = useState<'asigner' | 'mesdemandes'>('asigner')
  const [demandesASign, setDemandesASign] = useState(initialASign)
  const [mesCreations, setMesCreations] = useState(initialCreations)
  const [showModal, setShowModal] = useState(false)
  const [pageASign, setPageASign] = useState(1)
  const [pageCreations, setPageCreations] = useState(1)

  // Creation form state
  const [form, setForm] = useState({ titre: '', description: '' })
  const [selectedSignataires, setSelectedSignataires] = useState<string[]>([])
  const [externalEmails, setExternalEmails] = useState<string[]>([])
  const [externalEmailInput, setExternalEmailInput] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleDeleted(id: string) {
    setDemandesASign(list => list.filter(d => d.id !== id))
    setMesCreations(list => list.filter(d => d.id !== id))
  }

  function handleCorrected(demande: DemandeRow) {
    setMesCreations(list => list.map(d => d.id === demande.id ? demande : d))
    setDemandesASign(list => list.map(d => d.id === demande.id ? demande : d))
  }

  function toggleSignataire(id: string) {
    setSelectedSignataires(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  function addExternalEmail() {
    const email = externalEmailInput.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setCreateErr('Adresse email invalide.'); return }
    if (externalEmails.includes(email)) { setExternalEmailInput(''); return }
    const compteExistant = profiles.find(p => p.email?.toLowerCase() === email)
    if (compteExistant) {
      setCreateErr(`Cet email correspond déjà à un compte existant (${compteExistant.prenoms} ${compteExistant.nom}). Sélectionnez directement son nom dans la liste des signataires internes ci-dessous.`)
      return
    }
    setExternalEmails(prev => [...prev, email])
    setExternalEmailInput('')
    setCreateErr(null)
  }

  function removeExternalEmail(email: string) {
    setExternalEmails(prev => prev.filter(e => e !== email))
  }

  async function submitCreate() {
    if (!form.titre.trim()) { setCreateErr('Le titre est requis.'); return }
    if (selectedSignataires.length === 0 && externalEmails.length === 0) {
      setCreateErr('Choisissez au moins un signataire.'); return
    }

    setCreating(true); setCreateErr(null)
    const fd = new FormData()
    fd.append('titre', form.titre.trim())
    if (form.description.trim()) fd.append('description', form.description.trim())
    if (fichier) fd.append('fichier', fichier)
    fd.append('signataires', JSON.stringify(selectedSignataires))
    fd.append('signataires_externes', JSON.stringify(externalEmails))

    const res = await fetch('/api/signatures/create', { method: 'POST', body: fd })
    setCreating(false)

    if (res.ok) {
      const data = await res.json()
      setMesCreations(prev => [data.demande, ...prev])
      setShowModal(false)
      setForm({ titre: '', description: '' })
      setSelectedSignataires([])
      setExternalEmails([])
      setExternalEmailInput('')
      setFichier(null)
      if (fileRef.current) fileRef.current.value = ''
    } else {
      const data = await res.json().catch(() => ({}))
      setCreateErr(data.error ?? 'Erreur lors de la création')
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: 'none', borderRadius: 8,
    background: active ? 'var(--abed-green)' : 'transparent',
    color: active ? 'white' : '#374151',
  })

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Signatures électroniques</h2>
        <button
          onClick={() => { setShowModal(true); setCreateErr(null) }}
          style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none' }}
        >
          + Nouvelle demande
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f9fafb', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button style={tabStyle(activeTab === 'asigner')} onClick={() => setActiveTab('asigner')}>
          À signer {demandesASign.length > 0 && (
            <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
              {demandesASign.length}
            </span>
          )}
        </button>
        <button style={tabStyle(activeTab === 'mesdemandes')} onClick={() => setActiveTab('mesdemandes')}>
          Mes demandes
        </button>
      </div>

      {/* À signer tab */}
      {activeTab === 'asigner' && (
        <div>
          {demandesASign.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Aucun document en attente de votre signature.
            </div>
          ) : (
            <>
              {paginate(demandesASign, pageASign).map(d => (
                <DemandeCard key={d.id} d={d} userId={userId} onDeleted={handleDeleted} onCorrected={handleCorrected} />
              ))}
              <Pagination page={pageASign} total={demandesASign.length} onChange={setPageASign} />
            </>
          )}
        </div>
      )}

      {/* Mes demandes tab */}
      {activeTab === 'mesdemandes' && (
        <div>
          {mesCreations.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              Vous n'avez pas encore créé de demande de signature.
            </div>
          ) : (
            <>
              {paginate(mesCreations, pageCreations).map(d => (
                <DemandeCard key={d.id} d={d} userId={userId} onDeleted={handleDeleted} onCorrected={handleCorrected} />
              ))}
              <Pagination page={pageCreations} total={mesCreations.length} onChange={setPageCreations} />
            </>
          )}
        </div>
      )}

      {/* Creation modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 30, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 22, fontSize: 17, color: '#111827' }}>Nouvelle demande de signature</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Titre *</label>
              <input
                type="text"
                value={form.titre}
                onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex : Contrat de prestation Q3 2025"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Description (optionnel)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Contexte ou instructions pour les signataires..."
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Document PDF (optionnel)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => setFichier(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: '6px 10px' }}
              />
              {fichier && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📄 {fichier.name}</div>}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Inviter des signataires externes (par email)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  value={externalEmailInput}
                  onChange={e => setExternalEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExternalEmail() } }}
                  placeholder="email@exterieur.com"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={addExternalEmail}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', whiteSpace: 'nowrap' }}
                >
                  + Ajouter
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>
                La personne recevra un email avec un lien pour saisir son nom et signer, sans avoir besoin de compte.
              </p>
              {externalEmails.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {externalEmails.map(email => (
                    <span key={email} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
                    }}>
                      ✉️ {email}
                      <button
                        type="button"
                        onClick={() => removeExternalEmail(email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', fontWeight: 700, padding: 0, fontSize: 13, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Signataires internes ({selectedSignataires.length} sélectionné{selectedSignataires.length > 1 ? 's' : ''})</label>
              <div style={{
                border: '1px solid var(--abed-border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                background: '#fafafa',
              }}>
                {[...profiles].sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0)).map(p => {
                  const selected = selectedSignataires.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', cursor: 'pointer',
                        background: selected ? '#f0fdf4' : 'transparent',
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSignataire(p.id)}
                        style={{ accentColor: 'var(--abed-green)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ fontWeight: selected ? 600 : 400, color: selected ? 'var(--abed-green)' : '#374151' }}>
                        {p.prenoms} {p.nom}{p.id === userId ? ' (Moi-même)' : ''}
                      </span>
                      {p.role && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{p.role}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {createErr && (
              <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>
                {createErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowModal(false); setCreateErr(null) }}
                style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={submitCreate}
                disabled={creating}
                style={{
                  padding: '9px 20px', borderRadius: 8, cursor: creating ? 'not-allowed' : 'pointer',
                  background: 'var(--abed-green)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700,
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Création...' : 'Créer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
