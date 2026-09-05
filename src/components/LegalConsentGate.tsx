'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { CguBody, PolitiqueBody } from '@/lib/legal-content'

// Chemins où la fenêtre ne doit jamais s'afficher : les pages légales
// elles-mêmes (sinon impossible de les lire sans compte à côté), la
// connexion/inscription, et les liens publics sans session (offre externe,
// présence visiteurs...) où de toute façon /api/legal/statut répond
// toujours needsAcceptance:false en l'absence de session.
const CHEMINS_EXCLUS = ['/conditions-utilisation', '/politique-confidentialite', '/login', '/auth/']

const SEUIL_BAS_PX = 24

export default function LegalConsentGate() {
  const pathname = usePathname()
  const exclu = CHEMINS_EXCLUS.some(p => pathname?.startsWith(p))

  const [needsAcceptance, setNeedsAcceptance] = useState(false)
  const [checked, setChecked] = useState(false)
  const [tab, setTab] = useState<'cgu' | 'politique'>('cgu')
  const [luCgu, setLuCgu] = useState(false)
  const [luPolitique, setLuPolitique] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function verifierStatut() {
    try {
      const res = await fetch('/api/legal/statut')
      const d = await res.json()
      setNeedsAcceptance(!!d.needsAcceptance)
    } catch {
      // Silencieux : une erreur réseau ponctuelle ne doit pas bloquer
      // l'application entière, l'utilisateur sera re-vérifié à la prochaine
      // navigation/connexion.
    } finally {
      setChecked(true)
    }
  }

  useEffect(() => {
    if (exclu) return
    verifierStatut()
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') verifierStatut()
      if (event === 'SIGNED_OUT') setNeedsAcceptance(false)
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exclu])

  // Repart en haut de la nouvelle sous-fenêtre à chaque changement d'onglet.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [tab])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const enBas = el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_BAS_PX
    if (!enBas) return
    if (tab === 'cgu') setLuCgu(true)
    else setLuPolitique(true)
  }

  async function accepter() {
    setAccepting(true); setErr(null)
    try {
      const res = await fetch('/api/legal/accepter', { method: 'POST' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? 'Erreur — réessayez.'); return }
      setNeedsAcceptance(false)
    } catch {
      setErr('Erreur réseau — réessayez.')
    } finally {
      setAccepting(false)
    }
  }

  async function seDeconnecter() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (exclu || !checked || !needsAcceptance) return null

  const pretAAccepter = luCgu && luPolitique

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(17,24,39,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, width: '100%', maxWidth: 720, height: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.35)', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 28px 0', flexShrink: 0 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            Mise à jour de nos conditions
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
            Merci de lire l&apos;intégralité des deux documents ci-dessous — faites défiler chacun jusqu&apos;en
            bas pour pouvoir continuer.
          </p>
          <div style={{ display: 'flex', gap: 6, borderBottom: '1.5px solid #e5e7eb' }}>
            {([
              { key: 'cgu' as const, label: "Conditions d'utilisation", done: luCgu },
              { key: 'politique' as const, label: 'Politique de confidentialité', done: luPolitique },
            ]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                color: tab === t.key ? 'var(--abed-green, #1f7a1f)' : '#6b7280',
                borderBottom: tab === t.key ? '3px solid var(--abed-green, #1f7a1f)' : '3px solid transparent',
                marginBottom: -1.5,
              }}>
                {t.done && <CheckCircle2 size={14} color="#16a34a" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
          {tab === 'cgu' ? <CguBody /> : <PolitiqueBody />}
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
          {!pretAAccepter && (
            <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '0 0 10px' }}>
              {luCgu ? 'Il reste : Politique de confidentialité.' : luPolitique ? 'Il reste : Conditions d\'utilisation.' : 'Faites défiler les deux documents jusqu\'en bas.'}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={seDeconnecter} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
              Se déconnecter
            </button>
            <button
              onClick={accepter}
              disabled={!pretAAccepter || accepting}
              style={{
                marginLeft: 'auto', padding: '12px 28px', borderRadius: 999, fontSize: 14, fontWeight: 800,
                background: pretAAccepter ? 'linear-gradient(135deg, #1f7a1f, #16a34a)' : '#d1d5db',
                color: 'white', border: 'none', cursor: pretAAccepter ? 'pointer' : 'default',
                opacity: accepting ? .7 : 1,
              }}
            >
              {accepting ? 'Enregistrement...' : "J'ai lu et j'accepte les deux documents"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
