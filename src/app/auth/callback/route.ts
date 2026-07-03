import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/accueil'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // After email confirmation, move registration_status pending_email → pending_activation
    if (data?.user && next.includes('email-confirmed')) {
      await supabase
        .from('profiles')
        .update({ registration_status: 'pending_activation' })
        .eq('id', data.user.id)
        .eq('registration_status', 'pending_email')
    }
  }

  return NextResponse.redirect(`${appUrl}${next}`)
}
