'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

// Déconnexion automatique après 1h sans la moindre activité (souris,
// clavier, scroll, tactile) — sécurité pour les postes partagés. À
// l'expiration, un avertissement s'affiche 30 secondes avant la
// déconnexion effective ; pendant cet avertissement, seul un clic explicite
// sur « Rester connecté(e) » compte (l'activité passive — bouger la souris
// par-dessus la fenêtre — ne le fait plus disparaître, pour que
// l'avertissement remplisse vraiment son rôle).
const DELAI_INACTIVITE_MS = 60 * 60 * 1000
const DUREE_AVERTISSEMENT_S = 30
const EVENEMENTS_ACTIVITE = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const

export default function InactivityLogout() {
  const [connecte, setConnecte] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [secondes, setSecondes] = useState(DUREE_AVERTISSEMENT_S)
  const inactiviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const compteARebours = useRef<ReturnType<typeof setInterval> | null>(null)
  const showWarningRef = useRef(false)

  useEffect(() => { showWarningRef.current = showWarning }, [showWarning])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setConnecte(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setConnecte(false); setShowWarning(false) }
      else setConnecte(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function deconnecter() {
    if (compteARebours.current) clearInterval(compteARebours.current)
    const supabase = createClient()
    await supabase.auth.signOut()
    try {
      sessionStorage.setItem('abed_auth_toast', JSON.stringify({
        message: 'Déconnecté(e) automatiquement pour inactivité.', variant: 'logout',
      }))
    } catch { /* ignore */ }
    window.location.href = '/login'
  }

  function declencherAvertissement() {
    setShowWarning(true)
    setSecondes(DUREE_AVERTISSEMENT_S)
    compteARebours.current = setInterval(() => {
      setSecondes(s => {
        if (s <= 1) { deconnecter(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  function demarrerTimerInactivite() {
    if (inactiviteTimer.current) clearTimeout(inactiviteTimer.current)
    inactiviteTimer.current = setTimeout(declencherAvertissement, DELAI_INACTIVITE_MS)
  }

  function resterConnecte() {
    if (compteARebours.current) clearInterval(compteARebours.current)
    setShowWarning(false)
    demarrerTimerInactivite()
  }

  useEffect(() => {
    if (!connecte) return
    demarrerTimerInactivite()

    function onActivite() {
      // Une fois l'avertissement affiché, seul le bouton "Rester connecté(e)"
      // doit pouvoir l'annuler — pas un simple mouvement de souris.
      if (showWarningRef.current) return
      demarrerTimerInactivite()
    }
    EVENEMENTS_ACTIVITE.forEach(ev => window.addEventListener(ev, onActivite, { passive: true }))

    return () => {
      EVENEMENTS_ACTIVITE.forEach(ev => window.removeEventListener(ev, onActivite))
      if (inactiviteTimer.current) clearTimeout(inactiviteTimer.current)
      if (compteARebours.current) clearInterval(compteARebours.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte])

  if (!connecte || !showWarning) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(17,24,39,.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 420,
        padding: '28px 28px', boxShadow: '0 24px 64px rgba(0,0,0,.35)', textAlign: 'center',
      }}>
        <h3 style={{ margin: '0 0 10px', color: '#dc2626', fontSize: 19 }}>Toujours là ?</h3>
        <p style={{ fontSize: 14, color: '#374151', margin: '0 0 6px' }}>
          Vous allez être déconnecté(e) pour inactivité dans <strong>{secondes}</strong> seconde{secondes > 1 ? 's' : ''}.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
          Cliquez ci-dessous pour rester connecté(e).
        </p>
        <button className="btn" style={{ fontSize: 14, padding: '10px 28px' }} onClick={resterConnecte}>
          Rester connecté(e)
        </button>
      </div>
    </div>
  )
}
