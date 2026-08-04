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

  // Un observateur ne signe jamais — chip neutre distincte, sans icône de
  // statut de signature qui n'aurait pas de sens pour lui.
  if (s.est_observateur) {
    return (
      <span
        title="Reçoit le document par email une fois signé par tout le monde"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
        }}>
        👁 {name}{isExterne && <span title="Destinataire externe" style={{ fontWeight: 400 }}> (externe)</span>}
        <span style={{ fontWeight: 400, fontSize: 11 }}>· destinataire</span>
      </span>
    )
  }

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
  const canSign = !!myEntry && !myEntry.est_observateur && !myEntry.signe && d.statut === 'en_attente'
  const canDelete = d.createur_id === userId
  // Les observateurs (destinataires non-signataires) ne comptent pas dans le
  // "X/Y ont signé" — ils ne signent jamais.
  const vraisSignataires = d.signataires.filter(s => !s.est_observateur)
  const signed = vraisSignataires.filter(s => s.signe).length
  const total = vraisSignataires.length
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
  const [pageASign, setPageASign] = useState(1)
  const [pageCreations, setPageCreations] = useState(1)

  function handleDeleted(id: string) {
    setDemandesASign(list => list.filter(d => d.id !== id))
    setMesCreations(list => list.filter(d => d.id !== id))
  }

  function handleCorrected(demande: DemandeRow) {
    setMesCreations(list => list.map(d => d.id === demande.id ? demande : d))
    setDemandesASign(list => list.map(d => d.id === demande.id ? demande : d))
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
        <a
          href="/signatures/nouveau"
          style={{ display: 'inline-block', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--abed-green)', color: 'white', border: 'none', textDecoration: 'none' }}
        >
          + Nouvelle demande
        </a>
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
    </div>
  )
}
