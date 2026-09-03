import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { logRequest } from '@/lib/audit-log'

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  let res = NextResponse.next({ request: req })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
    {
      cookies: {
        getAll() {
          const header = req.headers.get('cookie') ?? ''
          if (!header) return []
          return header.split(';').map(c => {
            const idx = c.indexOf('=')
            return idx === -1
              ? { name: c.trim(), value: '' }
              : { name: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim() }
          })
        },
        setAll(cookiesToSet) {
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  // getSession() lit le jeton localement (aucun aller-retour réseau vers
  // Supabase à chaque requête, contrairement à getUser()) — plus rapide,
  // au prix de détecter un compte désactivé/bloqué avec un léger délai
  // (jusqu'à expiration du jeton) plutôt qu'instantanément. Choix assumé
  // pour la réactivité de l'application.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const path = req.nextUrl.pathname
  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/auth/') ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/fedapay') ||
    path.startsWith('/signatures/externe') ||
    path.startsWith('/api/signatures/externe') ||
    path.startsWith('/verify/om') ||
    path.startsWith('/api/verify/om') ||
    // Consultation de l'OM d'un missionnaire hors système, sans compte —
    // accès par jeton (voir om-externe-token.ts), jamais de session ici.
    // /api/om-pdf reste aussi accessible aux sessions normales : la route
    // fait elle-même la vérification (session OU jeton), le middleware ne
    // fait que ne pas la bloquer en amont pour le cas sans session.
    path.startsWith('/om/externe') ||
    path.startsWith('/api/om-pdf') ||
    // Enregistrement de présence des visiteurs — lien/QR public, jamais de
    // session (le visiteur n'a pas de compte My ABED).
    path.startsWith('/presence/') ||
    path.startsWith('/api/presence/') ||
    // Tâches planifiées (Vercel Cron, ou tout appel serveur-à-serveur type
    // pg_cron/pg_net) : jamais de session utilisateur sur ces appels, donc
    // sans cette exception le middleware les redirigeait vers /login avant
    // même d'atteindre la route — leur propre vérification CRON_SECRET
    // (dans chaque route) reste le vrai garde-fou, pas la session.
    path.startsWith('/api/cron/')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Journal d'audit : trace toute requête d'un utilisateur connecté (navigation
  // comprise). Écrit après coup via waitUntil — ne retarde jamais la réponse.
  // Les requêtes de simple préchargement de lien (survol) sont ignorées pour
  // ne pas polluer le journal d'entrées qui ne correspondent à aucune action réelle.
  if (user && req.headers.get('next-router-prefetch') !== '1') {
    event.waitUntil(logRequest({
      userId: user.id,
      method: req.method,
      path: path + req.nextUrl.search,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    }))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}