'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Fire both 'change' and a synthetic event (GT needs both in some browsers)
function fireEvent(el: HTMLSelectElement, eventName: string) {
  try {
    const evt = document.createEvent('HTMLEvents')
    evt.initEvent(eventName, true, true)
    el.dispatchEvent(evt)
  } catch {}
}

function doGTranslate(targetLang: string) {
  const sels = document.getElementsByTagName('select')
  let combo: HTMLSelectElement | null = null
  for (let i = 0; i < sels.length; i++) {
    if (sels[i].className.includes('goog-te-combo')) { combo = sels[i]; break }
  }
  const el = document.getElementById('google_translate_element')
  if (!el || el.innerHTML.length === 0 || !combo) {
    setTimeout(() => doGTranslate(targetLang), 300)
    return
  }
  combo.value = targetLang
  fireEvent(combo, 'change')
  // GT sometimes needs a second event
  setTimeout(() => { if (combo) fireEvent(combo, 'change') }, 100)
}

export function GoogleTranslateReapply() {
  const pathname = usePathname()

  useEffect(() => {
    // Re-apply translation after every SPA navigation
    const isEN = document.cookie.includes('googtrans=/fr/en')
    if (isEN) {
      setTimeout(() => doGTranslate('en'), 300)
    }
  }, [pathname])

  return null
}

export function useGoogleTranslate() {
  return {
    applyEN: () => {
      setCookiePair('/fr/en')
      doGTranslate('en')
    },
    applyFR: () => {
      clearCookiePair()
      doGTranslate('fr')
      // GT doesn't reliably restore FR — reload is safest
      setTimeout(() => window.location.reload(), 300)
    },
    isEN: () => typeof document !== 'undefined' && document.cookie.includes('googtrans=/fr/en'),
  }
}

function setCookiePair(value: string) {
  const host = window.location.hostname
  document.cookie = `googtrans=${value}; path=/`
  if (host !== 'localhost') {
    document.cookie = `googtrans=${value}; path=/; domain=.${host}`
  }
}

function clearCookiePair() {
  const host = window.location.hostname
  document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
  if (host !== 'localhost') {
    document.cookie = `googtrans=; path=/; domain=.${host}; expires=Thu, 01 Jan 1970 00:00:00 UTC`
  }
}
