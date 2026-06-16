'use client'
import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

const GREETING: Msg = {
  role: 'assistant',
  content: "Salut, je suis AGA 👋 Pose-moi une question sur ABED ou sur l'app My ABED (congés, timesheets, ordres de mission...).",
}

export default function AgaWidget() {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user', content: text } as Msg]
    setMessages(next)
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/aga/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.filter(m => m !== GREETING) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erreur')
      setMessages(m => [...m, { role: 'assistant', content: data.reply || '...' }])
    } catch (e: any) {
      setError(e.message || "AGA n'a pas pu répondre.")
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

  return (
    <>
      {/* Bulle flottante : cercle au repos, se déplie en pilule au survol */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label="Discuter avec AGA"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 500,
            display: 'flex', alignItems: 'center', gap: hover ? 10 : 0,
            background: 'var(--abed-green)', color: '#fff',
            border: 'none', borderRadius: 999,
            height: 52,
            width: hover ? 200 : 52,
            padding: hover ? '0 18px 0 12px' : 0,
            justifyContent: hover ? 'flex-start' : 'center',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(99,165,33,.4)',
            cursor: 'pointer', fontSize: 14, fontWeight: 700,
            transition: 'width .22s ease, padding .22s ease, gap .22s ease',
          }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
            flexShrink: 0,
          }}>💬</span>
          <span style={{
            whiteSpace: 'nowrap',
            opacity: hover ? 1 : 0,
            transition: 'opacity .15s ease',
          }}>Discuter avec AGA</span>
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          width: 360, maxWidth: 'calc(100vw - 32px)',
          height: 520, maxHeight: 'calc(100vh - 48px)',
          background: 'white', borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid var(--abed-border)',
        }}>
          {/* Header */}
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
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: 4, opacity: 0.9 }}
            >✕</button>
          </div>

          {/* Messages */}
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
            {error && (
              <div style={{ alignSelf: 'flex-start', fontSize: 12, color: '#b91c1c', padding: '4px 8px' }}>
                {error}
              </div>
            )}
          </div>

          {/* Saisie */}
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
                color: '#fff', border: 'none', borderRadius: 10, width: 40, flexShrink: 0,
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
      `}</style>
    </>
  )
}
