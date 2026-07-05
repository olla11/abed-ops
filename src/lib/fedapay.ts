import crypto from 'crypto'

const BASE = (process.env.FEDAPAY_BASE_URL ?? 'https://api.fedapay.com/v1').replace(/\/$/, '')
const SECRET = process.env.FEDAPAY_SECRET_KEY ?? ''

type CreateDebitParams = {
  montant: number
  telephone: string
  description: string
  missionId: string
  nom?: string
  prenoms?: string
  email?: string
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

export async function createMomoDebit(p: CreateDebitParams): Promise<{ fedapayTxId: string; paymentUrl: string }> {
  // 1. Créer la transaction
  // Normaliser le numéro : ajouter +229 si pas déjà présent
  const tel = p.telephone.startsWith('+') ? p.telephone : `+229${p.telephone.replace(/^0/, '')}`

  const tx = await fedapayFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      description: p.description,
      amount: Math.round(p.montant),
      currency: { iso: 'XOF' },
      custom_metadata: { mission_id: p.missionId },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/missions/${p.missionId}`,
      customer: {
        firstname: p.prenoms ?? '',
        lastname: p.nom ?? '',
        ...(p.email ? { email: p.email } : {}),
        phone_number: { number: tel, country: 'bj' },
      },
    }),
  })

  const txId = tx['v1/transaction']?.id ?? tx.transaction?.id ?? tx.id
  if (!txId) throw new Error(`FedaPay : impossible d'extraire l'id de transaction. Réponse : ${JSON.stringify(tx)}`)

  // 2. Tenter un paiement direct MTN (sans checkout) — FedaPay initie le push USSD immédiatement
  const telLocal = p.telephone.replace(/^\+229/, '').replace(/^0/, '')
  try {
    await fedapayFetch(`/transactions/${txId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'mtn_open',
        phone_number: telLocal,
      }),
    })
    // Si succès → pas besoin de checkout, retourner le lien de suivi mission
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.abedong.org').replace(/\/$/, '')
    return { fedapayTxId: String(txId), paymentUrl: `${appUrl}/missions/${p.missionId}` }
  } catch {
    // Fallback : générer le lien checkout si le paiement direct échoue
  }

  // 3. Fallback checkout — l'utilisateur paie via le formulaire FedaPay
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://my.abedong.org').replace(/\/$/, '')
  const tokenRes = await fedapayFetch(`/transactions/${txId}/token`, {
    method: 'POST',
    body: JSON.stringify({
      redirect_url: `${appUrl}/missions/${p.missionId}?paiement=ok`,
    }),
  })
  const paymentUrl: string =
    tokenRes.url ??
    tokenRes.payment_url ??
    `https://checkout.fedapay.com/checkout/${tokenRes.token ?? txId}`

  return { fedapayTxId: String(txId), paymentUrl }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET ?? ''
  if (!secret) return false // rejeter si secret non configuré
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
