// Jeton signé pour l'accès public (sans compte) à une Offre/Convention en
// attente d'un destinataire pas encore membre d'ABED — même mécanisme que
// external-signer-token.ts (HMAC-SHA256, comparaison en temps constant),
// mais durée de vie volontairement courte (72h) puisque ce lien est envoyé
// par email et n'importe qui le possédant peut consulter/signer le document.
import crypto from 'crypto'

function getSecret() {
  return process.env.EMAIL_VERIFY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
}

const PURPOSE = 'contrat-ext'
const TTL_MS = 72 * 60 * 60 * 1000 // 72 heures

export function signContratExterneToken(contratId: string, email: string): string {
  const expiresAt = Date.now() + TTL_MS
  const payload = `${PURPOSE}|${contratId}|${email}|${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function verifyContratExterneToken(token: string): { contratId: string; email: string; expiresAt: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 5 || parts[0] !== PURPOSE) return null
    const [, contratId, email, expiresAtStr, sig] = parts
    const payload = `${PURPOSE}|${contratId}|${email}|${expiresAtStr}`
    const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() > expiresAt) return null
    return { contratId, email, expiresAt }
  } catch {
    return null
  }
}
