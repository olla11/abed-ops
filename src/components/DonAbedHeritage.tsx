'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Award, Copy, Phone, Check } from 'lucide-react'
import { NOM_CLUB, MOMO_PAY_ABED, codeUssdDon } from '@/lib/dons'

export type DonMission = {
  id: string
  type: 'partenaire' | 'abandon_credit' | 'libre'
  pourcentage: number | null
  base_montant: number | null
  montant: number
  capture_path: string | null
  statut: 'declare' | 'confirme' | 'rejete'
}

const STATUT_DON: Record<DonMission['statut'], { label: string; color: string; bg: string }> = {
  declare: { label: 'Déclaré — à confirmer', color: '#92400e', bg: '#fef3c7' },
  confirme: { label: 'Confirmé', color: '#166534', bg: '#dcfce7' },
  rejete: { label: 'Non confirmé', color: '#991b1b', bg: '#fee2e2' },
}

export function DonReconciliationBlock({ don, peutTraiter, entete }: { don: DonMission; peutTraiter: boolean; entete?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'confirme' | 'rejete' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const s = STATUT_DON[don.statut]
  const traitable = peutTraiter && don.type !== 'abandon_credit' && don.statut === 'declare'

  async function voirCapture() {
    if (!don.capture_path) return
    const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(don.capture_path)}`)
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank')
    else setErr(json.error ?? 'Impossible d\'ouvrir la capture')
  }

  async function traiter(decision: 'confirme' | 'rejete') {
    setLoading(decision); setErr(null)
    const res = await fetch(`/api/dons/${don.id}/traiter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(null)
    if (!res.ok) { setErr(json.error ?? 'Erreur'); return }
    router.refresh()
  }

  return (
    <div style={{ marginTop: 14, border: '1px solid #a7f3d0', background: '#f7fdf9', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <Award size={16} color="#065f46" />
        <strong style={{ fontSize: 13.5, color: '#065f46' }}>{entete ?? `Don ${NOM_CLUB}`}</strong>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
      </div>
      <div style={{ fontSize: 13, color: '#374151' }}>
        {don.type === 'libre'
          ? <>Don spontané par MoMo de <strong>{Number(don.montant).toLocaleString('fr-FR')} F CFA</strong>.</>
          : don.type === 'partenaire'
          ? <>Versement MoMo de <strong>{Number(don.montant).toLocaleString('fr-FR')} F CFA</strong> ({don.pourcentage} % du montant reçu du partenaire).</>
          : <>Renonciation à <strong>{don.pourcentage} %</strong> du montant dû par ABED{don.statut === 'confirme' ? <> — soit <strong>{Number(don.montant).toLocaleString('fr-FR')} F CFA</strong></> : <> (déduit du remboursement à la clôture)</>}.</>}
      </div>
      {(don.capture_path || traitable || err) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          {don.capture_path && (
            <button className="btn secondary" style={{ fontSize: 12 }} onClick={voirCapture}>📎 Voir la capture du paiement</button>
          )}
          {traitable && (
            <>
              <button className="btn" style={{ fontSize: 12 }} onClick={() => traiter('confirme')} disabled={!!loading}>
                {loading === 'confirme' ? '…' : '✓ Paiement reçu — confirmer le don'}
              </button>
              <button className="btn danger" style={{ fontSize: 12 }} onClick={() => traiter('rejete')} disabled={!!loading}>
                {loading === 'rejete' ? '…' : 'Paiement introuvable'}
              </button>
            </>
          )}
          {err && <span style={{ fontSize: 12, color: '#991b1b' }}>{err}</span>}
        </div>
      )}
    </div>
  )
}

export function DonExhortation({ credit = false }: { credit?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
      border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#065f46',
    }}>
      <Award size={20} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong>Soutenez ABED, rejoignez {NOM_CLUB}.</strong>{' '}
        {credit
          ? 'À la réconciliation, vous pourrez renoncer à tout ou partie de votre remboursement au profit d\'ABED.'
          : 'À la réconciliation, vous pourrez faire un don du pourcentage de votre choix sur le montant reçu du partenaire.'}
        {' '}Les donateurs figurent chaque année au{' '}
        <Link href="/abed-heritage" style={{ color: '#065f46', fontWeight: 700 }}>tableau d&apos;honneur</Link>.
      </div>
    </div>
  )
}

export function DonLibreForm() {
  const router = useRouter()
  const [montant, setMontant] = useState(5000)
  const [capture, setCapture] = useState<File | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function envoyer() {
    if (!(montant >= 100)) { setMsg({ type: 'err', text: 'Montant minimum : 100 F CFA.' }); return }
    if (!capture) { setMsg({ type: 'err', text: 'Joignez la capture du paiement MoMo.' }); return }
    setEnvoi(true); setMsg(null)
    const fd = new FormData()
    fd.append('montant', String(montant))
    fd.append('capture', capture)
    const res = await fetch('/api/dons', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    setEnvoi(false)
    if (!res.ok) { setMsg({ type: 'err', text: json.error ?? 'Erreur' }); return }
    setMsg({ type: 'ok', text: `Merci ! Votre don sera compté dans ${NOM_CLUB} dès que l'AAF aura confirmé le paiement.` })
    setCapture(null)
    router.refresh()
  }

  return (
    <div className="card" style={{ border: '1px solid #a7f3d0', background: '#f7fdf9' }}>
      <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: '#065f46' }}>
        <Award size={18} /> Faire un don à ABED
      </h3>
      <p style={{ fontSize: 12.5, color: '#047857', marginBottom: 14 }}>
        À tout moment, du montant de votre choix. Chaque don confirmé vous fait rejoindre {NOM_CLUB} et compte pour le tableau d&apos;honneur de l&apos;année.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label className="label" style={{ margin: 0 }}>1. Montant (F CFA)</label>
          <input className="input" type="number" min={100} step={100} value={montant}
            onChange={e => setMontant(+e.target.value)} style={{ width: 140 }} />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>2. Payez par MoMo</div>
          <UssdDon montant={montant} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label className="label">3. Capture du paiement *</label>
          <input className="input" type="file" accept="image/*,.pdf" onChange={e => setCapture(e.target.files?.[0] ?? null)} />
        </div>
        {msg && (
          <div style={{ fontSize: 13, padding: '9px 12px', borderRadius: 8, background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
            {msg.text}
          </div>
        )}
        <button className="btn" onClick={envoyer} disabled={envoi} style={{ justifySelf: 'start' }}>
          {envoi ? 'Envoi…' : 'Soumettre mon don'}
        </button>
      </div>
    </div>
  )
}

export function UssdDon({ montant }: { montant: number }) {
  const [copie, setCopie] = useState(false)
  const code = codeUssdDon(montant)

  async function copier() {
    try {
      await navigator.clipboard.writeText(code)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch { /* presse-papiers indisponible : le code reste lisible à l'écran */ }
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--abed-border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginBottom: 4 }}>
        MoMo Pay ABED : <strong style={{ color: '#111827' }}>{MOMO_PAY_ABED}</strong> — composez :
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5, color: '#065f46', background: '#f0fdf4', padding: '6px 10px', borderRadius: 6 }}>
          {code}
        </code>
        <button type="button" className="btn secondary" onClick={copier} style={{ fontSize: 12, padding: '6px 12px' }}>
          {copie ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
        {/* Ouvre le clavier d'appel prérempli (Android) — iPhone bloque les
            codes USSD dans les liens, d'où le bouton Copier ci-dessus. */}
        <a href={`tel:${encodeURIComponent(code)}`} className="btn secondary" style={{ fontSize: 12, padding: '6px 12px', textDecoration: 'none' }}>
          <Phone size={13} /> Composer
        </a>
      </div>
    </div>
  )
}
