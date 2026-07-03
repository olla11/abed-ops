'use client'
import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

function setCookie(name: string, value: string) {
  const host = window.location.hostname
  document.cookie = `${name}=${value}; path=/; max-age=31536000`
  if (host !== 'localhost') {
    document.cookie = `${name}=${value}; path=/; max-age=31536000; domain=${host}`
  }
}

function deleteCookie(name: string) {
  const host = window.location.hostname
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC`
  if (host !== 'localhost') {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${host}`
  }
}

function applyGoogleTranslate(lang: string) {
  const sel = document.querySelector('.goog-te-combo') as HTMLSelectElement | null
  if (!sel) {
    setTimeout(() => applyGoogleTranslate(lang), 300)
    return
  }
  sel.value = lang
  sel.dispatchEvent(new Event('change'))
}

export default function LanguageSwitcher({ currentLocale }: { currentLocale?: string }) {
  const [isEN, setIsEN] = useState(false)

  useEffect(() => {
    setIsEN(getCookie('googtrans') === '/fr/en')
  }, [])

  function toggle() {
    if (isEN) {
      deleteCookie('googtrans')
      applyGoogleTranslate('fr')
      setIsEN(false)
    } else {
      setCookie('googtrans', '/fr/en')
      applyGoogleTranslate('en')
      setIsEN(true)
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
        transition: 'opacity 0.15s',
      }}
    >
      <Globe size={13} />
      {isEN ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  )
}
