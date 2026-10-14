'use client'
import { useState } from 'react'
import { attendrePoliceSignature } from '@/lib/signature-font'
import { formatSignatureDisplayName } from '@/lib/signature-name'

type Enregistrement = {
  numero: string
  signataireId: string
  demandeId: string
  prenoms: string
  nom: string
  signeLe: string // YYYY-MM-DD
  sigXPct: number
  sigYPct: number
}

// Les 11 bons de commande historiques (BC001 à BC011) et leur signataire —
// mêmes identifiants que ceux déjà insérés en base lors du backfill.
const ENREGISTREMENTS: Enregistrement[] = [
  { numero: 'BC001-26/ABED/DE/CAF/AAF', signataireId: 'bcecfb50-4d2a-4bea-a58d-b9c6dd48a49a', demandeId: 'a2aeb66a-0119-439e-9ee6-1ea43cdd65f2', prenoms: 'Ifèdé-Olla Aurès Parfait', nom: 'TCHICHE', signeLe: '2026-01-30', sigXPct: 71.6, sigYPct: 69.1 },
  { numero: 'BC002-26/ABED/DE/CAF/AAF', signataireId: '3f15f70f-6f9e-4bbd-a76d-50f938344283', demandeId: 'd8e912a6-c695-4ee2-b092-386403ab8b55', prenoms: 'Ifèdé-Olla Aurès Parfait', nom: 'TCHICHE', signeLe: '2026-02-26', sigXPct: 71.6, sigYPct: 69.9 },
  { numero: 'BC003-26/ABED/DE/CAF/AAF', signataireId: 'e74816d4-0ec4-4ba1-be8b-ec86cb7c60dd', demandeId: '42ab770e-fd0f-4596-9a89-bbeacf18964b', prenoms: 'Ifèdé-Olla Aurès Parfait', nom: 'TCHICHE', signeLe: '2026-03-03', sigXPct: 71.6, sigYPct: 67.3 },
  { numero: 'BC004-26/ABED/DE/CAF/AAF', signataireId: '97e62948-3453-49ff-895d-3c6554fe87c9', demandeId: '5b129722-9723-4308-89b8-e027c1208434', prenoms: 'Ifèdé-Olla Aurès Parfait', nom: 'TCHICHE', signeLe: '2026-05-27', sigXPct: 71.6, sigYPct: 68.9 },
  { numero: 'BC005-26/ABED/DE/CAF/AAF', signataireId: 'e25e6530-c358-4a64-951f-30dbf39ecb70', demandeId: 'cb11c550-f552-49ee-abd5-5638de733edf', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-06-22', sigXPct: 71.6, sigYPct: 68.4 },
  { numero: 'BC006-26/ABED/DE/CAF/AAF', signataireId: '4ab4f940-572c-4df5-9cec-900dcb87440f', demandeId: 'e1fe0ffa-d889-4066-8440-759c85e5b1bd', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-06-29', sigXPct: 71.6, sigYPct: 69.9 },
  { numero: 'BC007-26/ABED/DE/CAF/AAF', signataireId: '7953925f-26ec-49cf-9540-00bfaa3fe21c', demandeId: '47927e35-38bc-4abd-bdb6-7bf1ec44a0b2', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-07-01', sigXPct: 71.6, sigYPct: 67.3 },
  { numero: 'BC008-26/ABED/DE/CAF/AAF', signataireId: 'dd5f5562-0a61-46f3-a742-a0a0080c098a', demandeId: 'faebde60-ccf8-4ed2-8839-77609d336b49', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-07-02', sigXPct: 71.6, sigYPct: 67.3 },
  { numero: 'BC009-26/ABED/DE/CAF/AAF', signataireId: '1bd6626f-4aee-442b-9452-c513f194e41c', demandeId: 'd353ea17-fe0e-4518-8296-7135e3c6534a', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-09-14', sigXPct: 71.6, sigYPct: 71.5 },
  { numero: 'BC010-26/ABED/DE/CAF/AAF', signataireId: '0404c3fd-b185-4541-8cc2-f452a630a89d', demandeId: '96a3a0fd-bb6c-44be-acf4-25edb3c6fd9b', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-09-14', sigXPct: 71.6, sigYPct: 72.6 },
  { numero: 'BC011-26/ABED/DE/CAF/AAF', signataireId: 'cfa85244-7a08-491c-9062-3c0f39bdce87', demandeId: 'cb4509e0-f03f-48b8-bbc4-f12a4e1b54dc', prenoms: 'Modukpè Kawodjou Christine Victoire', nom: 'OGODJA', signeLe: '2026-09-18', sigXPct: 71.6, sigYPct: 71.0 },
]

const BRACKET_COLOR = '#2563eb'

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

// Port direct de captureSignatureImage() (SignerClient.tsx) — même tampon
// que celui apposé par un signataire réel via le circuit de signature.
async function genererTampon(userName: string, today: string, sigHash: string): Promise<string> {
  const SCALE = 3
  const BH = 80 * SCALE
  const hookLen = 13 * SCALE
  const fontSize = 24 * SCALE
  const cornerRadius = Math.round(BH * 0.047)
  const bracketInset = Math.round(BH * 0.165)
  const bx = 2 * SCALE
  const textX = bx + hookLen + 8 * SCALE
  const hashTexte = `${sigHash.slice(0, 12)}...`
  const dateHashGap = 10 * SCALE

  const mesure = document.createElement('canvas').getContext('2d')!
  mesure.font = `bold ${9 * SCALE}px Arial, sans-serif`
  const headerW = mesure.measureText('MYABED SIGNED BY:').width
  mesure.font = `${fontSize}px BrittanySignature`
  const nameW = mesure.measureText(userName).width
  mesure.font = `${8 * SCALE}px Arial, sans-serif`
  const dateW = mesure.measureText(today).width
  const hashW = mesure.measureText(hashTexte).width
  const footerW = dateW + dateHashGap + hashW

  const contentW = Math.max(headerW, nameW, footerW)
  const BW = Math.max(150 * SCALE, Math.ceil(textX + contentW + 6 * SCALE))

  const canvas = document.createElement('canvas')
  canvas.width = BW; canvas.height = BH
  const ctx = canvas.getContext('2d')!

  ctx.strokeStyle = BRACKET_COLOR
  ctx.lineWidth = 2 * SCALE
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bx + hookLen, bracketInset)
  ctx.lineTo(bx + cornerRadius, bracketInset)
  ctx.arcTo(bx, bracketInset, bx, bracketInset + cornerRadius, cornerRadius)
  ctx.lineTo(bx, BH - bracketInset - cornerRadius)
  ctx.arcTo(bx, BH - bracketInset, bx + cornerRadius, BH - bracketInset, cornerRadius)
  ctx.lineTo(bx + hookLen, BH - bracketInset)
  ctx.stroke()

  const contentAreaTop = BH * 0.18
  const contentAreaBottom = BH * 0.66
  const nameBaselineY = Math.round((contentAreaTop + contentAreaBottom) / 2 + fontSize * 0.32)

  ctx.fillStyle = '#374151'
  ctx.font = `bold ${9 * SCALE}px Arial, sans-serif`
  ctx.fillText('MYABED SIGNED BY:', textX, Math.round(BH * 0.155))

  ctx.fillStyle = '#000000'
  ctx.font = `${fontSize}px BrittanySignature`
  ctx.fillText(userName, textX, nameBaselineY)

  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1 * SCALE
  ctx.beginPath()
  ctx.moveTo(textX, Math.round(BH * 0.70))
  ctx.lineTo(BW - 4 * SCALE, Math.round(BH * 0.70))
  ctx.stroke()

  ctx.fillStyle = '#6b7280'
  ctx.font = `${8 * SCALE}px Arial, sans-serif`
  ctx.fillText(today, textX, Math.round(BH * 0.855))
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(hashTexte, textX + dateW + dateHashGap, Math.round(BH * 0.855))

  return canvas.toDataURL('image/png')
}

type Resultat = { numero: string; ok: boolean; error?: string }

export default function BackfillBcSignaturesClient() {
  const [loading, setLoading] = useState(false)
  const [resultats, setResultats] = useState<Resultat[] | null>(null)

  async function appliquer() {
    setLoading(true)
    setResultats([])
    await attendrePoliceSignature()

    for (const e of ENREGISTREMENTS) {
      try {
        const userName = formatSignatureDisplayName(e.prenoms, e.nom)
        const today = new Date(e.signeLe + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
        const sigHash = shortHash(userName + e.demandeId + today)
        const sigImageB64 = await genererTampon(userName, today, sigHash)

        const res = await fetch('/api/admin/backfill-bc-signatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signataireId: e.signataireId, sigImageB64, sigX: e.sigXPct, sigY: e.sigYPct, sigPage: 1 }),
        })
        const json = await res.json()
        setResultats(prev => [...(prev ?? []), { numero: e.numero, ok: res.ok, error: res.ok ? undefined : json.error }])
      } catch (err: any) {
        setResultats(prev => [...(prev ?? []), { numero: e.numero, ok: false, error: err?.message ?? String(err) }])
      }
    }
    setLoading(false)
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 8 }}>Appliquer les signatures des bons de commande historiques</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
        Outil ponctuel. Génère le même tampon de signature que le circuit de signature de l&apos;application
        (nom cursif, date, hash) pour les 11 bons de commande BC001 à BC011, et l&apos;enregistre pour qu&apos;il
        s&apos;affiche automatiquement sur le PDF — aucun fichier à téléverser ici.
      </p>

      <button className="btn" onClick={appliquer} disabled={loading}>
        {loading ? 'Application en cours…' : 'Appliquer les 11 signatures'}
      </button>

      {resultats && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {resultats.map((r, i) => (
            <div key={i} style={{
              fontSize: 13, padding: '8px 12px', borderRadius: 8,
              background: r.ok ? '#dcfce7' : '#fee2e2', color: r.ok ? '#166534' : '#991b1b',
            }}>
              {r.ok ? '✓' : '✗'} {r.numero} {r.error ? `— ${r.error}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
