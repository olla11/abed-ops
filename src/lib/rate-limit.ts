import { NextRequest, NextResponse } from 'next/server'

// In-memory store for edge-compatible rate limiting (per instance)
// For production at scale, replace with Upstash Redis when env vars are set
const counts = new Map<string, { count: number; reset: number }>()

type RateLimitOptions = {
  /** Max requests per window */
  limit: number
  /** Window in seconds */
  window: number
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// keyOverride (ex: user.id) évite qu'une route authentifiée partage son quota
// entre tous les collègues d'un même bureau (même IP publique derrière un
// routeur/NAT) — sans ça, le budget se vide bien plus vite que la limite
// configurée ne le laisse penser.
export function rateLimit(req: NextRequest, opts: RateLimitOptions, keyOverride?: string): NextResponse | null {
  const key = `${keyOverride ?? getIP(req)}:${new URL(req.url).pathname}`
  const now = Date.now()
  const windowMs = opts.window * 1000

  const entry = counts.get(key)
  if (!entry || now > entry.reset) {
    counts.set(key, { count: 1, reset: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > opts.limit) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Veuillez patienter avant de réessayer.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.reset - now) / 1000)) } }
    )
  }
  return null
}
