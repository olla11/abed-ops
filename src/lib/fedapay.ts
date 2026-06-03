import crypto from 'crypto'

const BASE = (process.env.FEDAPAY_BASE_URL ?? 'https://api.fedapay.com/v1').replace(/\/$/, '')
const SECRET = process.env.FEDAPAY_SECRET_KEY ?? ''

type CreateDebitParams = {
  montant: number
  telephone: string
  description: string
  missionId: string
}

async function fedapayFetch(path: string, init?: RequestInit) {
  if (!SECRET) throw new Error('FEDAPAY_SECRET_KEY non configuré dans les variables d\'environnement Vercel.')

  const url = `${BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (e: any) {
    throw new Error(`FedaPay réseau [${url}] : ${e.message}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  // FedaPay renvoie application/vnd.api+json — on accepte tout type JSON
  const isJson = contentType.includes('json')
  if (!isJson) {
    const text = await res.text()
    throw new Error(
      `FedaPay ${path} ${res.status} — réponse non-JSON (${contentType}). ` +
      `Vérifiez FEDAPAY_SECRET_KEY et FEDAPAY_BASE_URL dans Vercel. ` +
      `Début : ${text.slice(0, 200)}`
    )
  }

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? JSON.stringify(data)
    throw new Error(`FedaPay ${path} ${res.status} : ${msg}`)
  }
  return data
}

export async function createMomoDebit(p: CreateDebitParams) {
  // 1. Créer la transaction
  const tx = await fedapayFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      description: p.description,
      amount: Math.round(p.montant),
      currency: { iso: 'XOF' },
      custom_metadata: { mission_id: p.missionId },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/missions/${p.missionId}`,
    }),
  })

  const txId = tx['v1/transaction']?.id ?? tx.transaction?.id ?? tx.id
  if (!txId) throw new Error(`FedaPay : impossible d'extraire l'id de transaction. Réponse : ${JSON.stringify(tx)}`)

  // 2. Générer le token de paiement
  const tokenRes = await fedapayFetch(`/transactions/${txId}/token`, { method: 'POST' })
  const token = tokenRes.token
  if (!token) throw new Error(`FedaPay : token manquant dans la réponse token. ${JSON.stringify(tokenRes)}`)

  // 3. Initier le débit Mobile Money MTN (push USSD)
  await fedapayFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      token,
      mode: 'mtn_open',
      phone_number: { number: p.telephone, country: 'bj' },
    }),
  })

  return { fedapayTxId: String(txId) }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET ?? ''
  if (!secret) return true // désactivé si pas de secret configuré
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
