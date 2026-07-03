'use client'
import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

function getGoogTrans() {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;)\s*googtrans=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function setGoogTrans(value: string) {
  const host = window.location.hostname
  // Must set on both root domain and with domain= for GT to pick it up
  document.cookie = `googtrans=${value}; path=/`
  if (host !== 'localhost') {
    document.cookie = `googtrans=${value}; path=/; domain=.${host}`
  }
}

function clearGoogTrans() {
  const host = window.location.hostname
  document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
  if (host !== 'localhost') {
    document.cookie = `googtrans=; path=/; domain=.${host}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
  }
}

export default function LanguageSwitcher({ currentLocale }: { currentLocale?: string }) {
  const [isEN, setIsEN] = useState(false)

  useEffect(() => {
    setIsEN(getGoogTrans() === '/fr/en')
  }, [])

  function toggle() {
    if (isEN) {
      clearGoogTrans()
      setIsEN(false)
      // Reset GT to French
      if (typeof window !== 'undefined' && (window as any).__gtApplyLang) {
        (window as any).__gtApplyLang('fr')
        setTimeout(() => window.location.reload(), 400)
      } else {
        window.location.reload()
      }
    } else {
      setGoogTrans('/fr/en')
      setIsEN(true)
      // Apply EN immediately via GT widget
      if (typeof window !== 'undefined' && (window as any).__gtApplyLang) {
        (window as any).__gtApplyLang('en')
      } else {
        window.location.reload()
      }
    }
  }

  return (
    <button
      onClick={toggle}
      title={isEN ? 'Passer en français' : 'Switch to English'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'none', border: '1px solid var(--abed-border)',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        fontSize: 12, fontWeight: 700, color: 'var(--abed-text)',
      }}
    >
      <Globe size={13} />
      {isEN ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  )
}
