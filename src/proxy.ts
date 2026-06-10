import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const isPublic = path.startsWith('/login') || path.startsWith('/api/fedapay') || path.startsWith('/auth')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}