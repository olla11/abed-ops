'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

const APP_URL = 'https://my.abedong.org'
const STORAGE_KEY = 'abed-lang'

function buildTranslateURL(targetUrl: string) {
  return `https://translate.google.com/translate?sl=fr&tl=en&u=${encodeURIComponent(targetUrl)}`
}

export default function LanguageSwitcher() {
  const pathname = usePathname()
  const [isEN, setIsEN] = useState(false)

  useEffect(() => {
    setIsEN(localStorage.getItem(STORAGE_KEY) === 'en')
  }, [])

  // When inside Google Translate frame, navigating goes through translate.google.com
  // so we don't need to re-redirect on pathname changes inside the iframe.
  // But if someone navigates back to the plain site while EN preference is stored,
  // we detect that and redirect them back into the translated frame.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pref = localStorage.getItem(STORAGE_KEY)
    if (pref !== 'en') return
    // If we're already inside the GT frame, window.location.hostname will be translate.google.com
    // so we won't be executing this code. If we're on the plain site, redirect.
    const currentHost = window.location.hostname
    if (currentHost !== 'translate.googleusercontent.com' && currentHost !== 'translate.google.com') {
      window.location.href = buildTranslateURL(`${APP_URL}${pathname}`)
    }
  }, [pathname])

  function toggle() {
    if (isEN) {
      localStorage.removeItem(STORAGE_KEY)
      // Navigate to the plain (non-translated) version of the page
      window.location.href = `${APP_URL}${pathname}`
    } else {
      localStorage.setItem(STORAGE_KEY, 'en')
      setIsEN(true)
      window.location.href = buildTranslateURL(window.location.href)
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
