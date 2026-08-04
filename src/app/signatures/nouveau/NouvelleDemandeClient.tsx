'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ProfileOption } from '../page'

type Zone = { page: number; x: number; y: number }
type PickEntry = { type: 'interne' | 'externe'; value: string }

function entryKey(e: PickEntry) { return `${e.type}:${e.value}` }

// Taille (en % de la page) du rectangle représentant une zone de signature —
// proportions proches d'un vrai tampon de signature.
const ZONE_W_PCT = 18
const ZONE_H_PCT = 7

/**
 * Aperçu du PDF (fichier local, pas encore uploadé) avec un rectangle vert
 * déplaçable par signataire, placé au premier clic puis glissé pour
 * l'ajuster. Duplique volontairement la logique de rendu pdf.js des
 * éditeurs de signature (PdfCanvasViewer) — même convention que le reste du code.
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
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  // Rectangle déjà placé : on peut le saisir directement pour le déplacer,
  // sans repasser par la sélection de la pastille du signataire.
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const dragOffsetRef = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(fichier)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [fichier])

  useEffect(() => {
    if (!blobUrl) return
    let cancelled = false
    setRendering(true)
    setError(null)
    async function render() {
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      const pdf = await lib.getDocument({ url: blobUrl! }).promise
      if (cancelled) return
      setNumPages(pdf.numPages)
      const pageObj = await pdf.getPage(Math.min(page, pdf.numPages))
      if (cancelled) return
      // clientWidth peut valoir 0 si le conteneur n'a pas encore fini sa mise
      // en page — voir le même correctif sur les pages de signature. On
      // attend une frame avant de se rabattre sur une largeur par défaut,
      // pour éviter un canvas invisible sans erreur.
      let containerWidth = wrapperRef.current?.clientWidth || 0
      if (containerWidth === 0) {
        await new Promise(r => requestAnimationFrame(r))
        if (cancelled) return
        containerWidth = wrapperRef.current?.clientWidth || 700
      }
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
    render().catch(err => {
      if (cancelled) return
      console.error('[ZonePdfEditor] Échec du rendu PDF :', err)
      setRendering(false)
      setError('Impossible d\'afficher un aperçu de ce PDF.')
    })
    return () => { cancelled = true }
  }, [blobUrl, page, retryCount])

  function handleClick(e: React.MouseEvent) {
    if (!activeKey) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.round(Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100)) * 10) / 10
    const y = Math.round(Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100)) * 10) / 10
    onPlace(activeKey, page, x, y)
  }

  function handleRectMouseDown(key: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    const zone = zones[key]
    if (!rect || !zone) return
    const centerX = rect.left + (zone.x / 100) * rect.width
    const centerY = rect.top + (zone.y / 100) * rect.height
    dragOffsetRef.current = { dx: e.clientX - centerX, dy: e.clientY - centerY }
    setDraggingKey(key)
  }

  useEffect(() => {
    if (!draggingKey) return
    function onMove(e: MouseEvent) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect || !draggingKey) return
      const x = Math.round(Math.max(2, Math.min(98, ((e.clientX - dragOffsetRef.current.dx - rect.left) / rect.width) * 100)) * 10) / 10
      const y = Math.round(Math.max(2, Math.min(98, ((e.clientY - dragOffsetRef.current.dy - rect.top) / rect.height) * 100)) * 10) / 10
      onPlace(draggingKey, page, x, y)
    }
    function onUp() { setDraggingKey(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [draggingKey, page, onPlace])

  const markersOnPage = entries
    .map((e, i) => ({ key: entryKey(e), i, zone: zones[entryKey(e)] }))
    .filter((m): m is { key: string; i: number; zone: Zone } => !!m.zone && m.zone.page === page)

  return (
    <div>
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', minHeight: 320, background: '#525659', borderRadius: 8, overflow: 'hidden' }}>
        {rendering && !error && (
          <div style={{ position: 'absolute', inset: 0, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13, zIndex: 3 }}>
            Chargement...
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, minHeight: 320, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', color: '#fca5a5', fontSize: 13, textAlign: 'center', padding: 16, zIndex: 3 }}>
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setRetryCount(c => c + 1)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #6b7280', background: 'transparent', color: '#e5e7eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Réessayer
            </button>
          </div>
        )}
        <canvas ref={canvasRef} onClick={handleClick}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: activeKey ? 'crosshair' : 'default', visibility: error ? 'hidden' : 'visible' }} />
        {markersOnPage.map(m => (
          <div key={m.key}
            onMouseDown={e => handleRectMouseDown(m.key, e)}
            title="Glisser pour déplacer cette zone"
            style={{
              position: 'absolute', left: `${m.zone.x}%`, top: `${m.zone.y}%`,
              width: `${ZONE_W_PCT}%`, minWidth: 110, height: `${ZONE_H_PCT}%`, minHeight: 40,
              transform: 'translate(-50%, -50%)',
              border: '2px solid var(--abed-green)', background: 'rgba(99,165,33,0.16)',
              borderRadius: 6, cursor: draggingKey === m.key ? 'grabbing' : 'grab', zIndex: 4,
              boxShadow: draggingKey === m.key ? '0 4px 14px rgba(0,0,0,.3)' : 'none',
            }}>
            <span style={{
              position: 'absolute', top: -11, left: 6, padding: '2px 8px', borderRadius: 20,
              background: 'var(--abed-green)', color: 'white', fontSize: 11, fontWeight: 700,
              whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,.3)', pointerEvents: 'none',
            }}>
              {m.i + 1}. {labels[m.key] ?? m.key}
            </span>
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

const sectionCard: React.CSSProperties = {
  background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16,
}

type Props = {
  userId: string
  profiles: ProfileOption[]
}

export default function NouvelleDemandeClient({ userId, profiles }: Props) {
  const router = useRouter()

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
  // L'aperçu et les zones de signature reposent sur pdf.js, qui ne sait lire
  // que du PDF — un document Word/Excel est accepté en pièce jointe mais
  // sans aperçu ni zone imposée.
  const isPdf = !!fichier && (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name))

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
    if (!fichier) { setCreateErr('Le document est requis.'); return }
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
      router.push('/signatures')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setCreateErr(data.error ?? 'Erreur lors de la création')
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <a href="/signatures" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 600 }}>← Retour</a>
        <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: 0 }}>Nouvelle demande de signature</h2>
      </div>

      <div style={{ ...sectionCard, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Titre *</label>
          <input
            type="text"
            value={form.titre}
            onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
            placeholder="Ex : Contrat de prestation Q3 2025"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Document *</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={e => setFichier(e.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: '6px 10px' }}
          />
          {fichier && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>📄 {fichier.name}</div>}
          <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>
            PDF, Word (.doc/.docx) ou Excel (.xls/.xlsx). L&apos;aperçu et les zones de signature ne sont disponibles que pour un PDF.
          </p>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description (optionnel)</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Contexte ou instructions pour les signataires..."
            style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 340, maxWidth: 460 }}>
          {pickOrder.length > 0 && (
            <div style={sectionCard}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>
                Ordre de signature ({pickOrder.length} personne{pickOrder.length > 1 ? 's' : ''})
              </label>
              <p style={{ fontSize: 11, color: 'var(--abed-muted)', margin: '0 0 8px' }}>
                Chaque personne ne sera notifiée qu'une fois la précédente ayant signé.
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
                {pickOrder.map((entry) => {
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

          <div style={sectionCard}>
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

          <div style={sectionCard}>
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

          <div style={sectionCard}>
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
        </div>

        <div style={{ flex: '2 1 520px', minWidth: 420 }}>
          <div style={sectionCard}>
            <label style={{ ...labelStyle, marginBottom: 4 }}>Zones de signature (optionnel)</label>
            {!fichier ? (
              <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: 0 }}>
                Ajoutez le document ci-dessus pour définir, si vous le souhaitez, l'endroit précis où chaque personne devra signer. Sans zone définie, chacun choisit librement où signer.
              </p>
            ) : !isPdf ? (
              <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: 0 }}>
                L&apos;aperçu et les zones de signature ne sont disponibles que pour un document PDF — <strong>{fichier.name}</strong> sera tout de même joint à la demande, et chacun choisira librement où signer.
              </p>
            ) : pickOrder.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: 0 }}>
                Ajoutez au moins un signataire pour pouvoir lui attribuer une zone de signature.
              </p>
            ) : (
              <>
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
                          background: active ? 'var(--abed-green)' : (has ? '#f0fdf4' : 'white'),
                          color: active ? 'white' : (has ? '#166534' : '#374151'),
                          border: `1px solid ${active ? 'var(--abed-green)' : (has ? '#86efac' : 'var(--abed-border)')}`,
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
              </>
            )}
          </div>
        </div>
      </div>

      {createErr && (
        <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: '#fee2e2', borderRadius: 8 }}>
          {createErr}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6, paddingBottom: 30 }}>
        <a
          href="/signatures"
          style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'white', border: '1px solid var(--abed-border)', fontSize: 13, textDecoration: 'none', color: '#374151' }}
        >
          Annuler
        </a>
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
  )
}
