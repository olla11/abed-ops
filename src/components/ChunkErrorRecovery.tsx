'use client'
import { useEffect } from 'react'

// Après chaque redéploiement, un onglet déjà ouvert référence encore les
// anciens fichiers JS (chunks) — un clic qui en charge un dynamiquement
// échoue alors silencieusement, parfois perçu comme "la page n'a pas pu
// s'afficher". Un seul rechargement complet suffit à repartir sur la
// nouvelle version ; le garde-fou sessionStorage évite une boucle si le
// rechargement échoue aussi (ex: coupure réseau).
const CLE_GARDE = 'abed_chunk_reload_guard'
const MOTIFS = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i

export default function ChunkErrorRecovery() {
  useEffect(() => {
    // La page a fini de monter avec succès — le garde-fou ne doit bloquer
    // qu'une boucle de rechargements rapprochés, pas toutes les erreurs de
    // chunk futures de cette même session.
    const t = setTimeout(() => {
      try { sessionStorage.removeItem(CLE_GARDE) } catch { /* ignore */ }
    }, 5000)
    function estErreurDeChunk(message: unknown): boolean {
      return typeof message === 'string' && MOTIFS.test(message)
    }

    function recharger() {
      let dejaTente = false
      try { dejaTente = sessionStorage.getItem(CLE_GARDE) === '1' } catch { /* ignore */ }
      if (dejaTente) return
      try { sessionStorage.setItem(CLE_GARDE, '1') } catch { /* ignore */ }
      window.location.reload()
    }

    function onError(e: ErrorEvent) {
      if (estErreurDeChunk(e.message) || estErreurDeChunk(e.error?.message)) recharger()
    }
    function onRejection(e: PromiseRejectionEvent) {
      if (estErreurDeChunk(e.reason?.message) || estErreurDeChunk(String(e.reason))) recharger()
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      clearTimeout(t)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
