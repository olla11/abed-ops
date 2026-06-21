'use client'
import { useRouter } from 'next/navigation'

type Signataire = {
  profile_id: string
  signe: boolean
  signe_le: string | null
  sig_x: number | null
  sig_y: number | null
  sig_page: number | null
  profile: { nom: string; prenoms: string } | null
}

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0 }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, '0')
}

const BRACKET_COLOR = '#2563eb'

function sigRotation(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return ((Math.abs(h) % 40) - 20) / 10
}

function SignatureBlock({ name, date, hash, small }: { name: string; date: string; hash: string; small?: boolean }) {
  const bw = small ? 190 : 240
  const bh = small ? 72 : 90
  const barW = 2
  const hookLen = small ? 9 : 13
  return (
    <div style={{ position: 'relative', width: bw, height: bh, background: 'white', pointerEvents: 'none' }}>
      <style>{`@font-face { font-family: 'BrittanySignature'; src: url('/fonts/BrittanySignature.ttf') format('truetype'); font-weight: normal; font-style: normal; }`}</style>
      <svg width={hookLen + 4} height={bh} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <line x1={2} y1={2} x2={2 + hookLen} y2={2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
        <line x1={2} y1={2} x2={2} y2={bh - 2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
        <line x1={2} y1={bh - 2} x2={2 + hookLen} y2={bh - 2} stroke={BRACKET_COLOR} strokeWidth={barW} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left: hookLen + 8, top: 0, right: 4, bottom: 0, display: 'flex', flexDirection: 'column', paddingTop: 6, paddingBottom: 5 }}>
        <div style={{ fontSize: small ? 7.5 : 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', marginBottom: 2 }}>
          MyABED signed by:
        </div>
        <div style={{
          fontFamily: '"BrittanySignature", cursive',
          fontSize: small ? 26 : 34,
          color: '#000',
          lineHeight: 1.1,
          letterSpacing: '0.04em',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          fontWeight: 400,
        }}>
          {name}
        </div>
        <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 3, fontSize: small ? 7 : 8, color: '#6b7280', display: 'flex', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif' }}>
          <span>{date}</span>
          <span style={{ color: '#9ca3af' }}>{hash.slice(0, 12)}...</span>
        </div>
      </div>
    </div>
  )
}

export default function ViewClient({ titre, docUrl, signataires }: { titre: string; docUrl: string | null; signataires: Signataire[] }) {
  const router = useRouter()
  const signedSigs = signataires.filter(s => s.signe && s.sig_x != null && s.sig_y != null)

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* PDF + signature overlays */}
        <div style={{ flex: '0 0 70%', background: '#525659', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', background: '#3d4043', fontSize: 13, fontWeight: 600, color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>📄 {titre}</span>
            <button onClick={() => router.back()}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#4b5563', color: '#e5e7eb', border: 'none' }}>
              ← Retour
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {!docUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
                Aucun fichier joint
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <iframe src={docUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={titre} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Signatures list */}
        <div style={{ flex: '0 0 30%', padding: '24px 20px', background: 'white', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111827' }}>Signataires</h3>
          {signataires.map(s => {
            const name = s.profile ? `${s.profile.prenoms} ${s.profile.nom}` : s.profile_id
            return (
              <div key={s.profile_id} style={{ marginBottom: 14, padding: '12px 14px', border: '1px solid', borderColor: s.signe ? '#86efac' : '#fde68a', borderRadius: 8, background: s.signe ? '#f0fdf4' : '#fefce8' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{name}</div>
                {s.signe ? (
                  <>
                    <div style={{ fontSize: 12, color: '#166534' }}>
                      ✅ Signé le {s.signe_le ? new Date(s.signe_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    {s.sig_x != null && (
                      <div style={{ marginTop: 8 }}>
                        <SignatureBlock
                          name={name}
                          date={s.signe_le ? new Date(s.signe_le).toLocaleDateString('fr-FR') : ''}
                          hash={shortHash(s.profile_id + (s.signe_le ?? ''))}
                          small
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#92400e' }}>⏳ En attente de signature</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
