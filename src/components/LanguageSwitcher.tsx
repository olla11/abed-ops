'use client'
import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

function setGTCookie() {
  const host = window.location.hostname
  document.cookie = 'googtrans=/fr/en; path=/'
  if (host !== 'localhost') {
    document.cookie = `googtrans=/fr/en; path=/; domain=.${host}`
  }
}

function clearGTCookie() {
  const host = window.location.hostname
  document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
  if (host !== 'localhost') {
    document.cookie = `googtrans=; path=/; domain=.${host}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
  }
}

export default function LanguageSwitcher() {
  const [isEN, setIsEN] = useState(false)

  useEffect(() => {
    setIsEN(document.cookie.includes('googtrans=/fr/en'))
  }, [])

  function toggle() {
    if (isEN) {
      clearGTCookie()
      window.location.reload()
    } else {
      setGTCookie()
      setIsEN(true)
      if (typeof (window as any).__doGT === 'function') {
        (window as any).__doGT('en')
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
