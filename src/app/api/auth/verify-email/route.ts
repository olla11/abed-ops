import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function getSecret() {
  return process.env.EMAIL_VERIFY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
}

export function signVerifyToken(userId: string, email: string): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  const payload = `${userId}|${email}|${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 4) return null
    const [userId, email, expiresAtStr, sig] = parts
    const payload = `${userId}|${email}|${expiresAtStr}`
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
    if (Date.now() > parseInt(expiresAtStr)) return null
    return { userId, email }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'

  if (!token) {
    return NextResponse.redirect(`${appUrl}/auth/email-confirmed?status=invalid`)
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.redirect(`${appUrl}/auth/email-confirmed?status=expired`)
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Confirm the user's email in Supabase
  const { error } = await admin.auth.admin.updateUserById(payload.userId, {
    email_confirm: true,
  })

  if (error) {
    return NextResponse.redirect(`${appUrl}/auth/email-confirmed?status=error`)
  }

  // Update profile status
  await admin
    .from('profiles')
    .update({ registration_status: 'pending_activation' })
    .eq('id', payload.userId)
    .eq('registration_status', 'pending_email')

  return NextResponse.redirect(`${appUrl}/auth/email-confirmed?status=ok`)
}
