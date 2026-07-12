import crypto from 'crypto'

function getSecret() {
  return process.env.EMAIL_VERIFY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
}

const PURPOSE = 'sig'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export function signExternalSignerToken(signataireId: string, email: string): string {
  const expiresAt = Date.now() + TTL_MS
  const payload = `${PURPOSE}|${signataireId}|${email}|${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function verifyExternalSignerToken(token: string): { signataireId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 5 || parts[0] !== PURPOSE) return null
    const [, signataireId, email, expiresAtStr, sig] = parts
    const payload = `${PURPOSE}|${signataireId}|${email}|${expiresAtStr}`
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
    if (Date.now() > parseInt(expiresAtStr)) return null
    return { signataireId, email }
  } catch {
    return null
  }
}
