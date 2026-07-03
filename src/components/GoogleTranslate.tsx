'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function GoogleTranslateReapply() {
  const pathname = usePathname()

  useEffect(() => {
    if (!document.cookie.includes('googtrans=/fr/en')) return
    // After SPA navigation Next.js swaps the DOM — re-trigger translation
    const timer = setTimeout(() => {
      if (typeof (window as any).__doGT === 'function') {
        (window as any).__doGT('en')
      }
    }, 400)
    return () => clearTimeout(timer)
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
