// Jeton signé pour l'accès public (sans compte) à un Ordre de Mission dont le
// missionnaire est une personne hors système — mêmes principes que
// contrat-externe-token.ts (HMAC-SHA256, comparaison en temps constant),
// mais TTL plus long (30 jours) : ce lien sert seulement à consulter/
// télécharger le PDF déjà signé, pas à engager une action urgente.
import crypto from 'crypto'

function getSecret() {
  return process.env.EMAIL_VERIFY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
}

const PURPOSE = 'om-ext'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export function signOmExterneToken(missionId: string, email: string): string {
  const expiresAt = Date.now() + TTL_MS
  const payload = `${PURPOSE}|${missionId}|${email}|${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function verifyOmExterneToken(token: string): { missionId: string; email: string; expiresAt: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 5 || parts[0] !== PURPOSE) return null
    const [, missionId, email, expiresAtStr, sig] = parts
    const payload = `${PURPOSE}|${missionId}|${email}|${expiresAtStr}`
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null
    return { missionId, email, expiresAt }
  } catch {
    return null
  }
}
