// =====================================================================
// FedaPay — Prélèvement 20% par Mobile Money (MTN)
// =====================================================================
// Flux :
// 1) createMomoDebit() crée une transaction et envoie un push USSD au
//    numéro du missionnaire. Il confirme sur son téléphone.
// 2) FedaPay appelle notre webhook (/api/fedapay/webhook) à la
//    confirmation. C'est CE webhook qui valide la mission, jamais
//    le retour client.
// =====================================================================

const BASE = process.env.FEDAPAY_BASE_URL!
const SECRET = process.env.FEDAPAY_SECRET_KEY!

type CreateDebitParams = {
  montant: number          // en F CFA (entier)
  telephone: string        // format international, ex: 22994xxxxxx
  description: string
  missionId: string        // passé en metadata pour retrouver la mission au webhook
}

async function fedapayFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`FedaPay ${path} ${res.status}: ${JSON.stringify(data)}`)
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
      // metadata pour relier le webhook à la mission
      custom_metadata: { mission_id: p.missionId },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/missions/${p.missionId}`,
    }),
  })

  const txId = tx['v1/transaction'].id

  // 2. Générer le token de paiement et déclencher le push MoMo MTN
  const tokenRes = await fedapayFetch(`/transactions/${txId}/token`, {
    method: 'POST',
  })
  const token = tokenRes.token

  // 3. Initier le débit Mobile Money MTN (envoie le push USSD)
  await fedapayFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      token,
      mode: 'mtn_open',          // MTN MoMo Bénin
      phone_number: {
        number: p.telephone,
        country: 'bj',           // Bénin
      },
    }),
  })

  return { fedapayTxId: String(txId) }
}

// Vérifie la signature du webhook (HMAC). FedaPay envoie l'en-tête X-FEDAPAY-SIGNATURE.
import crypto from 'crypto'
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET!
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  // comparaison à temps constant
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
