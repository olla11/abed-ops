'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { setLocale } from '@/app/actions/locale'

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggle() {
    const next = currentLocale === 'fr' ? 'en' : 'fr'
    startTransition(async () => {
      await setLocale(next as 'fr' | 'en')
      router.refresh()
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={currentLocale === 'fr' ? 'Switch to English' : 'Passer en français'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'none', border: '1px solid var(--abed-border)',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        fontSize: 12, fontWeight: 700, color: 'var(--abed-text)',
        opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s',
      }}
    >
      <Globe size={13} />
      {currentLocale === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
    </button>
  )
}
