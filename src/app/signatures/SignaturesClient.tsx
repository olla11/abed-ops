'use client'
import { useState, useRef, useEffect } from 'react'
import type { DemandeRow, ProfileOption, SignataireRow } from './page'
import Pagination, { paginate, PAGE_SIZE } from '@/components/Pagination'

type Zone = { page: number; x: number; y: number }
type PickEntry = { type: 'interne' | 'externe'; value: string }

function entryKey(e: PickEntry) { return `${e.type}:${e.value}` }

const MARKER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777']

/**
 * Aperçu du PDF (fichier local, pas encore uploadé) avec un repère nommé par
 * signataire déjà positionné, et placement au clic pour le signataire actif.
 * Duplique volontairement la logique de rendu pdf.js des éditeurs de
 * signature (PdfCanvasViewer) — même convention que le reste du code.
 */
function ZonePdfEditor({
  fichier, entries, labels, zones, activeKey, page, onPageChange, onPlace,
}: {
  fichier: File
  entries: PickEntry[]
  labels: Record<string, string>
  zones: Record<string, Zone>
  activeKey: string | null
  page: number
  onPageChange: (n: number) => void
  onPlace: (key: string, page: number, x: number, y: number) => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    const url = URL.createObjectURL(fichier)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])

  useEffect(() => {
    if (!blobUrl) return
    let cancelled = false
    setRendering(true)
    async function render() {
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      const pdf = await lib.getDocument({ url: blobUrl! }).promise
      if (cancelled) return
      setNumPages(pdf.numPages)
      const pageObj = await pdf.getPage(Math.min(page, pdf.numPages))
      if (cancelled) return
      const containerWidth = wrapperRef.current?.clientWidth || 700
      const unscaledVp = pageObj.getViewport({ scale: 1 })
      const scale = containerWidth / unscaledVp.width
      const viewport = pageObj.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await pageObj.render({ canvasContext: ctx, viewport, canvas }).promise
      if (!cancelled) setRendering(false)
    }
    render().catch(() => { if (!cancelled) setRendering(false) })
    return () => { cancelled = true }
  }, [blobUrl, page])

  function handleClick(e: React.MouseEvent) {
    if (!activeKey) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100)) * 10) / 10
    const y = Math.round(Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100)) * 10) / 10
    onPlace(activeKey, page, x, y)
  }

  const markersOnPage = entries
    .map((e, i) => ({ key: entryKey(e), i, zone: zones[entryKey(e)] }))
    .filter((m): m is { key: string; i: number; zone: Zone } => !!m.zone && m.zone.page === page)

  return (
    <div>
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', background: '#525659', borderRadius: 8, overflow: 'hidden' }}>
        {rendering && (
          <div style={{ position: 'absolute', inset: 0, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13, zIndex: 3 }}>
            Chargement...
          </div>
        )}
        <canvas ref={canvasRef} onClick={handleClick}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: activeKey ? 'crosshair' : 'default' }} />
        {markersOnPage.map(m => (
          <div key={m.key} style={{
            position: 'absolute', left: `${m.zone.x}%`, top: `${m.zone.y}%`, transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20,
            background: MARKER_COLORS[m.i % MARKER_COLORS.length], color: 'white', fontSize: 11, fontWeight: 700,
            whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,.35)', pointerEvents: 'none', zIndex: 4,
          }}>
            {m.i + 1}. {labels[m.key] ?? m.key}
          </div>
        ))}
      </div>
      {numPages && numPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
            style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', background: page <= 1 ? '#f3f4f6' : 'white', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}>
            ‹ Précédent
          </button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} / {numPages}</span>
          <button type="button" onClick={() => onPageChange(Math.min(numPages, page + 1))} disabled={page >= numPages}
            style={{ padding: '3px 12px', borderRadius: 6, border: '1px solid var(--abed-border)', background: page >= numPages ? '#f3f4f6' : 'white', cursor: page >= numPages ? 'default' : 'pointer', fontSize: 12 }}>
            Suivant ›
          </button>
        </div>
      )}
    </div>
  )
}

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
  const [showModal, setShowModal] = useState(false)
  const [pageASign, setPageASign] = useState(1)
  const [pageCreations, setPageCreations] = useState(1)

  // Creation form state
  const [form, setForm] = useState({ titre: '', description: '' })
  const [selectedSignataires, setSelectedSignataires] = useState<string[]>([])
  const [internalSearch, setInternalSearch] = useState('')
  const [externalEmails, setExternalEmails] = useState<string[]>([])
  const [externalEmailInput, setExternalEmailInput] = useState('')
  // Ordre unifié de signature : mélange interne/externe dans l'ordre réel où
  // la personne a été ajoutée (peu importe la section du formulaire), pour
  // que l'ordre choisi soit exactement celui respecté à la signature.
  const [pickOrder, setPickOrder] = useState<PickEntry[]>([])
  // Zones de signature imposées (optionnel) : position figée par signataire,
  // choisie par le créateur sur un aperçu du PDF avant envoi.
  const [zones, setZones] = useState<Record<string, Zone>>({})
  const [zoneActiveKey, setZoneActiveKey] = useState<string | null>(null)
  const [zonePage, setZonePage] = useState(1)
  // Destinataires non-signataires : reçoivent le document par email une fois
  // signé par tout le monde, mais ne signent jamais eux-mêmes.
  const [selectedObservateurs, setSelectedObservateurs] = useState<string[]>([])
  const [observateurSearch, setObservateurSearch] = useState('')
  const [observateurEmails, setObservateurEmails] = useState<string[]>([])
  const [observateurEmailInput, setObservateurEmailInput] = useState('')
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

  function labelFor(entry: PickEntry): string {
    if (entry.type === 'externe') return entry.value
    const p = profiles.find(pp => pp.id === entry.value)
    return p ? `${p.prenoms} ${p.nom}` : entry.value
  }

  function removeZone(key: string) {
    setZones(prev => { const next = { ...prev }; delete next[key]; return next })
    setZoneActiveKey(k => k === key ? null : k)
  }

  function toggleSignataire(id: string) {
    const alreadySelected = selectedSignataires.includes(id)
    setSelectedSignataires(prev => alreadySelected ? prev.filter(x => x !== id) : [...prev, id])
    setPickOrder(prev => alreadySelected
      ? prev.filter(e => !(e.type === 'interne' && e.value === id))
      : [...prev, { type: 'interne', value: id }])
    if (alreadySelected) removeZone(entryKey({ type: 'interne', value: id }))
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
    setPickOrder(prev => [...prev, { type: 'externe', value: email }])
    setExternalEmailInput('')
    setCreateErr(null)
  }

  function removeExternalEmail(email: string) {
    setExternalEmails(prev => prev.filter(e => e !== email))
    setPickOrder(prev => prev.filter(e => !(e.type === 'externe' && e.value === email)))
    removeZone(entryKey({ type: 'externe', value: email }))
  }

  function toggleObservateur(id: string) {
    setSelectedObservateurs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function addObservateurEmail() {
    const email = observateurEmailInput.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) { setCreateErr('Adresse email invalide.'); return }
    if (observateurEmails.includes(email)) { setObservateurEmailInput(''); return }
    const compteExistant = profiles.find(p => p.email?.toLowerCase() === email)
    if (compteExistant) {
      setCreateErr(`Cet email correspond déjà à un compte existant (${compteExistant.prenoms} ${compteExistant.nom}). Sélectionnez directement son nom dans la liste des destinataires internes ci-dessous.`)
      return
    }
    setObservateurEmails(prev => [...prev, email])
    setObservateurEmailInput('')
    setCreateErr(null)
  }

  function removeObservateurEmail(email: string) {
    setObservateurEmails(prev => prev.filter(e => e !== email))
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
    fd.append('ordre_signataires', JSON.stringify(pickOrder))
    fd.append('zones_signature', JSON.stringify(zones))
    fd.append('observateurs', JSON.stringify(selectedObservateurs))
    fd.append('observateurs_externes', JSON.stringify(observateurEmails))

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
      setPickOrder([])
      setZones({})
      setZoneActiveKey(null)
      setZonePage(1)
      setSelectedObservateurs([])
      setObservateurEmails([])
      setObservateurEmailInput('')
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

            {pickOrder.length > 0 && (
              <div style={{ marginBottom: 14, background: '#f9fafb', border: '1px solid var(--abed-border)', borderRadius: 8, padding: '10px 14px' }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>
                  Ordre de signature ({pickOrder.length} personne{pickOrder.length > 1 ? 's' : ''})
                </label>
                <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '0 0 8px' }}>
                  Chaque personne ne sera notifiée qu'une fois la précédente ayant signé.
                </p>
                <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
                  {pickOrder.map((entry, i) => {
                    const label = labelFor(entry)
                    return (
                      <li key={`${entry.type}-${entry.value}`} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1 }}>{entry.type === 'externe' ? '✉️ ' : ''}{label}</span>
                        <button
                          type="button"
                          onClick={() => entry.type === 'interne' ? toggleSignataire(entry.value) : removeExternalEmail(entry.value)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontWeight: 700, padding: 0, fontSize: 13, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}

            {fichier && pickOrder.length > 0 && (
              <div style={{ marginBottom: 14, background: '#f9fafb', border: '1px solid var(--abed-border)', borderRadius: 8, padding: '10px 14px' }}>
                <label style={{ ...labelStyle, marginBottom: 4 }}>Zones de signature (optionnel)</label>
                <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '0 0 8px' }}>
                  Cliquez sur une personne ci-dessous puis sur l'endroit du document où elle devra signer. Sans zone définie, la personne choisit librement où signer (comportement actuel).
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {pickOrder.map((entry, i) => {
                    const key = entryKey(entry)
                    const active = zoneActiveKey === key
                    const has = !!zones[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setZoneActiveKey(active ? null : key)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: active ? MARKER_COLORS[i % MARKER_COLORS.length] : (has ? '#f0fdf4' : 'white'),
                          color: active ? 'white' : (has ? '#166534' : '#374151'),
                          border: `1px solid ${active ? MARKER_COLORS[i % MARKER_COLORS.length] : (has ? '#86efac' : 'var(--abed-border)')}`,
                        }}
                      >
                        {i + 1}. {labelFor(entry)} {has && !active ? '✓' : ''}
                      </button>
                    )
                  })}
                </div>
                {zoneActiveKey && (
                  <p style={{ fontSize: 11, color: '#1e40af', margin: '0 0 8px' }}>
                    👆 Cliquez sur le document à l'endroit où <strong>{labelFor(pickOrder.find(e => entryKey(e) === zoneActiveKey)!)}</strong> devra signer.
                  </p>
                )}
                <ZonePdfEditor
                  fichier={fichier}
                  entries={pickOrder}
                  labels={Object.fromEntries(pickOrder.map(e => [entryKey(e), labelFor(e)]))}
                  zones={zones}
                  activeKey={zoneActiveKey}
                  page={zonePage}
                  onPageChange={setZonePage}
                  onPlace={(key, page, x, y) => {
                    setZones(prev => ({ ...prev, [key]: { page, x, y } }))
                    setZoneActiveKey(null)
                  }}
                />
                {Object.keys(zones).length > 0 && (
                  <button type="button" onClick={() => setZones({})}
                    style={{ marginTop: 8, fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', color: '#6b7280' }}>
                    Effacer toutes les zones
                  </button>
                )}
              </div>
            )}

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
              <input
                type="text"
                placeholder="🔍 Rechercher un nom…"
                value={internalSearch}
                onChange={e => setInternalSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{
                border: '1px solid var(--abed-border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto',
                background: '#fafafa',
              }}>
                {[...profiles]
                  .filter(p => selectedSignataires.includes(p.id) || `${p.prenoms} ${p.nom}`.toLowerCase().includes(internalSearch.trim().toLowerCase()))
                  .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0)).map(p => {
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
                {profiles.filter(p => selectedSignataires.includes(p.id) || `${p.prenoms} ${p.nom}`.toLowerCase().includes(internalSearch.trim().toLowerCase())).length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--abed-muted)', textAlign: 'center', padding: '14px 0', margin: 0 }}>Aucun résultat.</p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 18, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <label style={labelStyle}>Destinataires (optionnel — ne signent pas)</label>
              <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: -2, marginBottom: 8 }}>
                Ces personnes ne signent rien : elles recevront le document par email, en pièce jointe, une fois signé par tous les signataires.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="email"
                  value={observateurEmailInput}
                  onChange={e => setObservateurEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObservateurEmail() } }}
                  placeholder="email@exterieur.com"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={addObservateurEmail}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#1e40af', color: 'white', border: 'none', whiteSpace: 'nowrap' }}
                >
                  + Ajouter
                </button>
              </div>
              {observateurEmails.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {observateurEmails.map(email => (
                    <span key={email} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe',
                    }}>
                      👁 {email}
                      <button
                        type="button"
                        onClick={() => removeObservateurEmail(email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', fontWeight: 700, padding: 0, fontSize: 13, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                placeholder="🔍 Rechercher un nom…"
                value={observateurSearch}
                onChange={e => setObservateurSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{
                border: '1px solid var(--abed-border)', borderRadius: 8, maxHeight: 160, overflowY: 'auto',
                background: '#fafafa',
              }}>
                {profiles
                  .filter(p => !selectedSignataires.includes(p.id))
                  .filter(p => selectedObservateurs.includes(p.id) || `${p.prenoms} ${p.nom}`.toLowerCase().includes(observateurSearch.trim().toLowerCase()))
                  .map(p => {
                    const selected = selectedObservateurs.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 14px', cursor: 'pointer',
                          background: selected ? '#eff6ff' : 'transparent',
                          borderBottom: '1px solid #f3f4f6',
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleObservateur(p.id)}
                          style={{ accentColor: '#1e40af', width: 15, height: 15, flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: selected ? 600 : 400, color: selected ? '#1e40af' : '#374151' }}>
                          {p.prenoms} {p.nom}
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
