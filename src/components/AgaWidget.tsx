'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

type Msg = { role: 'user' | 'assistant'; content: string }

type AgaError = {
  code: 'invalid_key' | 'rate_limit' | 'service_unavailable' | 'no_key' | 'unknown' | 'network'
  retryable: boolean
  groqMsg?: string
}

const ERROR_INFO: Record<AgaError['code'], { icon: string; title: string; detail: string }> = {
  no_key: {
    icon: '🔑',
    title: 'Clé API non configurée',
    detail: 'La clé GEMINI_API_KEY est absente dans les variables d\'environnement Vercel. Ajoutez-la dans les paramètres du projet (Settings → Environment Variables) et redéployez.',
  },
  invalid_key: {
    icon: '🚫',
    title: 'Clé API invalide',
    detail: 'La clé GEMINI_API_KEY configurée dans Vercel est incorrecte ou expirée. Obtenez une clé gratuite sur aistudio.google.com → Get API Key et mettez-la à jour dans Vercel.',
  },
  rate_limit: {
    icon: '⏳',
    title: 'Quota Gemini atteint',
    detail: 'La limite gratuite Gemini est temporairement atteinte. Attendez quelques secondes et réessayez.',
  },
  service_unavailable: {
    icon: '🌐',
    title: 'Service Gemini indisponible',
    detail: 'Les serveurs Google Gemini rencontrent un problème temporaire. Réessayez dans quelques minutes.',
  },
  network: {
    icon: '📡',
    title: 'Erreur réseau',
    detail: 'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
  },
  unknown: {
    icon: '⚠️',
    title: 'Erreur inattendue',
    detail: 'Une erreur s\'est produite côté serveur. Réessayez ou contactez l\'administration.',
  },
}

const GREETING: Msg = {
  role: 'assistant',
  content: "Salut, je suis AGA 👋 Pose-moi une question sur ABED ou sur l'app My ABED (congés, timesheets, ordres de mission...).",
}

// ── Bulle déplaçable ──
// La bulle peut être glissée n'importe où à l'écran (souris ou doigt) pour
// libérer les boutons qu'elle recouvrirait (ex. onglet "Menu" de la barre
// mobile). Un simple appui l'ouvre ; un glissement la déplace. Au lâcher,
// elle se colle au bord gauche ou droit le plus proche, et sa position est
// mémorisée (localStorage) pour toutes les pages.
const BUBBLE = 56
const MARGIN = 12
const HEADER_H = 60
const TABBAR_H = 62 // doit correspondre à --tabbar-h dans globals.css
const DRAG_THRESHOLD = 6
const POS_KEY = 'aga-bubble-pos'

type Pos = { x: number; y: number }

function isMobile() { return typeof window !== 'undefined' && window.innerWidth <= 768 }

function bounds() {
  const bottomReserved = isMobile() ? TABBAR_H + MARGIN : MARGIN
  return {
    minX: MARGIN,
    maxX: window.innerWidth - BUBBLE - MARGIN,
    minY: HEADER_H + MARGIN,
    maxY: window.innerHeight - BUBBLE - bottomReserved,
  }
}

function clamp(p: Pos): Pos {
  const b = bounds()
  return { x: Math.min(Math.max(p.x, b.minX), b.maxX), y: Math.min(Math.max(p.y, b.minY), b.maxY) }
}

function defaultPos(): Pos {
  const b = bounds()
  // Par défaut sur mobile : au-dessus de la barre d'onglets, mi-hauteur
  // basse, pour ne jamais recouvrir "Menu" au premier affichage.
  return isMobile() ? { x: b.maxX, y: b.maxY - 80 } : { x: b.maxX, y: b.maxY }
}

function snap(p: Pos): Pos {
  const b = bounds()
  const mid = window.innerWidth / 2 - BUBBLE / 2
  return clamp({ x: p.x < mid ? b.minX : b.maxX, y: p.y })
}

export default function AgaWidget() {
  const pathname = usePathname()
  const dansLeHub = pathname?.startsWith('/projets') ?? false
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AgaError | null>(null)
  const lastMessagesRef = useRef<Msg[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  const [pos, setPos] = useState<Pos | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startX: number; startY: number; origin: Pos; moved: boolean; id: number } | null>(null)

  useEffect(() => {
    let saved: Pos | null = null
    try { const raw = localStorage.getItem(POS_KEY); if (raw) saved = JSON.parse(raw) } catch {}
    setPos(clamp(saved ?? defaultPos()))
    function onResize() { setPos(p => (p ? clamp(p) : p)) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setHidden(document.body.classList.contains('panel-open'))
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, origin: pos, moved: false, id: e.pointerId }
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!d.moved) { d.moved = true; setDragging(true) }
    setPos(clamp({ x: d.origin.x + dx, y: d.origin.y + dy }))
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (d.moved) {
      setDragging(false)
      setPos(p => {
        if (!p) return p
        const s = snap(p)
        try { localStorage.setItem(POS_KEY, JSON.stringify(s)) } catch {}
        return s
      })
    } else {
      setOpen(true)
    }
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user', content: text } as Msg]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)
    lastMessagesRef.current = next
    try {
      const res = await fetch('/api/aga/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.filter(m => m !== GREETING) }),
      })
      const data = await res.json()
      if (!res.ok) {
        const code: AgaError['code'] = data?.error ?? 'unknown'
        const retryable = ['rate_limit', 'service_unavailable', 'unknown', 'network'].includes(code)
        setError({ code, retryable, groqMsg: data?.groqMsg })
        return
      }
      setMessages(m => [...m, { role: 'assistant', content: data.reply || '...' }])
    } catch {
      setError({ code: 'network', retryable: true })
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (hidden || dansLeHub || !pos) return null

  return (
    <>
      {/* Bulle flottante déplaçable */}
      {!open && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Discuter avec AGA (glisser pour déplacer)"
          title="Appuyer pour discuter · glisser pour déplacer"
          style={{
            position: 'fixed', left: pos.x, top: pos.y, zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--abed-green)', color: '#fff',
            border: 'none', borderRadius: '50%',
            height: BUBBLE, width: BUBBLE,
            boxShadow: dragging ? '0 14px 32px rgba(0,0,0,.28)' : '0 8px 24px rgba(99,165,33,.4)',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
            transform: dragging ? 'scale(1.08)' : 'none',
            transition: dragging ? 'transform .1s, box-shadow .1s' : 'left .2s ease, top .2s ease, transform .1s, box-shadow .1s',
            opacity: dragging ? 0.92 : 1,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" style={{ pointerEvents: 'none' }}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {/* Fenêtre de chat — sur mobile, occupe l'espace entre l'en-tête et la
          barre d'onglets (classe .aga-window dans le <style> ci-dessous). */}
      {open && (
        <div className="aga-window" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          width: 360, maxWidth: 'calc(100vw - 32px)',
          height: 520, maxHeight: 'calc(100vh - 48px)',
          background: 'white', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid var(--abed-border)',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--abed-green), var(--abed-green-dark))',
            color: '#fff', padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>AGA</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Assistant ABED</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: 8, opacity: 0.9, minWidth: 40, minHeight: 40 }}
            >✕</button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--abed-green)' : '#fff',
                color: m.role === 'user' ? '#fff' : '#1f2937',
                border: m.role === 'user' ? 'none' : '1px solid var(--abed-border)',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '9px 12px',
                fontSize: 13.5, lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                boxShadow: m.role === 'assistant' ? '0 1px 3px rgba(0,0,0,.04)' : 'none',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', background: '#fff', border: '1px solid var(--abed-border)',
                borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4,
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--abed-muted)',
                    opacity: 0.5, animation: `aga-bounce 1s ${i * 0.15}s infinite ease-in-out`,
                  }} />
                ))}
              </div>
            )}
            {error && (() => {
              const info = ERROR_INFO[error.code]
              return (
                <div style={{
                  alignSelf: 'stretch',
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{info.icon}</span>
                    <strong style={{ fontSize: 13, color: '#991b1b' }}>{info.title}</strong>
                  </div>
                  <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 6px', lineHeight: 1.5 }}>
                    {info.detail}
                  </p>
                  {error.groqMsg && (
                    <p style={{ fontSize: 11, color: '#991b1b', background: '#fff', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 8px', margin: '0 0 10px', fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {error.groqMsg}
                    </p>
                  )}
                  {error.retryable && (
                    <button
                      onClick={async () => {
                        setError(null)
                        setLoading(true)
                        try {
                          const res = await fetch('/api/aga/chat', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ messages: lastMessagesRef.current.filter(m => m !== GREETING) }),
                          })
                          const data = await res.json()
                          if (!res.ok) {
                            setError({ code: data?.error ?? 'unknown', retryable: ['rate_limit','service_unavailable','network','unknown'].includes(data?.error) })
                          } else {
                            setMessages(m => [...m, { role: 'assistant', content: data.reply || '...' }])
                          }
                        } catch {
                          setError({ code: 'network', retryable: true })
                        } finally {
                          setLoading(false)
                        }
                      }}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#991b1b',
                        background: 'white', border: '1px solid #fca5a5',
                        borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                      }}
                    >
                      🔄 Réessayer
                    </button>
                  )}
                </div>
              )
            })()}
          </div>

          <div style={{ borderTop: '1px solid var(--abed-border)', padding: 10, display: 'flex', gap: 8, background: '#fff' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Écris ton message à AGA..."
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid var(--abed-border)', borderRadius: 10,
                padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
                maxHeight: 80,
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? '#d1d5db' : 'var(--abed-green)',
                color: '#fff', border: 'none', borderRadius: 10, width: 44, flexShrink: 0,
                cursor: loading || !input.trim() ? 'default' : 'pointer', fontSize: 16,
              }}
            >➤</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aga-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @media (max-width: 768px) {
          .aga-window {
            top: ${HEADER_H + 8}px !important; left: 8px !important; right: 8px !important;
            bottom: calc(${TABBAR_H + 8}px + env(safe-area-inset-bottom)) !important;
            width: auto !important; height: auto !important; max-width: none !important; max-height: none !important;
          }
        }
      `}</style>
    </>
  )
}
