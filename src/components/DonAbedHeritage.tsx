'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Award, Copy, Phone, Check, Upload } from 'lucide-react'
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
          ? `Don spontané par MoMo de ${Number(don.montant).toLocaleString('fr-FR')} F CFA.`
          : don.type === 'partenaire'
          ? `Versement MoMo de ${Number(don.montant).toLocaleString('fr-FR')} F CFA (${don.pourcentage} % du montant reçu du partenaire).`
          : don.statut === 'confirme'
          ? `Renonciation à ${don.pourcentage} % du montant dû par ABED, soit ${Number(don.montant).toLocaleString('fr-FR')} F CFA.`
          : `Renonciation à ${don.pourcentage} % du montant dû par ABED (déduit du remboursement à la clôture).`}
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
  const texte = credit
    ? `À la réconciliation, vous pourrez renoncer à tout ou partie de votre remboursement au profit de ABED. Les donateurs figurent chaque année au `
    : `À la réconciliation, vous pourrez faire un don du pourcentage de votre choix sur le montant reçu du partenaire. Les donateurs figurent chaque année au `
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
      border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#065f46',
    }}>
      <Award size={20} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong style={{ display: 'block', marginBottom: 2 }}>{`Soutenez ABED, rejoignez ${NOM_CLUB}.`}</strong>
        <span>{texte}</span>
        <Link href="/abed-heritage" style={{ color: '#065f46', fontWeight: 700 }}>tableau d&apos;honneur</Link>.
      </div>
    </div>
  )
}

const MONTANTS_RAPIDES = [1000, 2000, 5000, 10000, 25000]

function Etape({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 12 }}>
      <span style={{
        width: 30, height: 30, borderRadius: '50%', background: '#065f46', color: 'white',
        fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', margin: '5px 0 10px' }}>{titre}</div>
        {children}
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
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #a7f3d0' }}>
      <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', color: 'white', padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800 }}>
          <Award size={20} color="#fcd34d" /> Faire un don à ABED
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          {`À tout moment, du montant de votre choix. Chaque don confirmé vous fait rejoindre ${NOM_CLUB} et compte pour le tableau d'honneur de l'année.`}
        </div>
      </div>

      <div style={{ padding: '20px 22px', display: 'grid', gap: 20 }}>
        <Etape n={1} titre="Choisissez le montant">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {MONTANTS_RAPIDES.map(m => (
              <button key={m} type="button" onClick={() => setMontant(m)} style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${montant === m ? '#065f46' : '#a7f3d0'}`,
                background: montant === m ? '#065f46' : 'white', color: montant === m ? 'white' : '#065f46',
              }}>
                {m.toLocaleString('fr-FR')}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input className="input" type="number" min={100} step={100} value={montant} aria-label="Autre montant"
                onChange={e => setMontant(+e.target.value)} style={{ width: 120 }} />
              <span style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>F CFA</span>
            </div>
          </div>
        </Etape>

        <Etape n={2} titre="Payez par MoMo">
          <UssdDon montant={montant} />
        </Etape>

        <Etape n={3} titre="Joignez la capture du paiement">
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px dashed ${capture ? '#065f46' : '#a7f3d0'}`, background: capture ? '#f0fdf4' : 'white',
            fontSize: 13, color: capture ? '#065f46' : '#6b7280',
          }}>
            {capture ? <Check size={18} /> : <Upload size={18} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {capture ? capture.name : 'Cliquez pour choisir une image ou un PDF'}
            </span>
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={e => setCapture(e.target.files?.[0] ?? null)} />
          </label>
        </Etape>

        {msg && (
          <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2', color: msg.type === 'ok' ? '#166534' : '#991b1b' }}>
            {msg.text}
          </div>
        )}

        <button className="btn" onClick={envoyer} disabled={envoi}
          style={{ width: '100%', justifyContent: 'center', padding: '13px 0', fontSize: 14.5 }}>
          {envoi ? 'Envoi…' : `Soumettre mon don de ${Math.max(0, montant || 0).toLocaleString('fr-FR')} F CFA`}
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
