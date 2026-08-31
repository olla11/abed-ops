// Consultation publique (sans compte My ABED) de l'Ordre de Mission signé
// d'un missionnaire hors système — lien à jeton envoyé par email à la
// signature, cf. src/lib/om-externe-token.ts et signer/route.ts. Simple
// consultation/téléchargement, aucune action à effectuer (contrairement à
// contrats/externe qui attend une signature).
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyOmExterneToken } from '@/lib/om-externe-token'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export default async function OmExternePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const token = t ?? ''
  const payload = verifyOmExterneToken(token)

  if (!payload) {
    return (
      <Card>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Lien invalide ou expiré</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Ce lien n&apos;est plus valide (il expire 30 jours après son envoi). Contactez ABED ONG pour en recevoir un nouveau.</p>
      </Card>
    )
  }

  const admin = createAdminClient()
  const { data: m } = await admin
    .from('missions')
    .select('id, reference, objet, lieu, status, signe_le, date_depart, date_retour, missionnaire_externe_email, missionnaire_externe_prenoms, missionnaire_externe_nom')
    .eq('id', payload.missionId)
    .single()

  if (!m || m.missionnaire_externe_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return (
      <Card>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>Lien invalide</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Ce lien est introuvable ou ne correspond plus à un ordre de mission actif.</p>
      </Card>
    )
  }

  const green = '#2d7a31'

  return (
    <Card>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <h2 style={{ color: green, fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>
        Bonjour {m.missionnaire_externe_prenoms} {m.missionnaire_externe_nom},
      </h2>
      <p style={{ fontSize: 14, color: '#374151', margin: '0 0 24px', lineHeight: 1.6 }}>
        Votre ordre de mission a été signé et est prêt à être téléchargé.
      </p>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', marginBottom: 24, textAlign: 'left' }}>
        <Row label="Référence" value={m.reference ?? '—'} />
        <Row label="Objet" value={m.objet ?? '—'} />
        <Row label="Lieu" value={m.lieu ?? '—'} />
        <Row label="Période" value={`${m.date_depart ?? '—'} → ${m.date_retour ?? '—'}`} />
      </div>
      <a
        href={`/api/om-pdf?missionId=${m.id}&t=${token}`}
        target="_blank"
        style={{ display: 'inline-block', background: green, color: 'white', padding: '13px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
      >
        Télécharger le PDF
      </a>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '24px 0 0' }}>ABED ONG · Parakou, Quartier Zongo, Bénin</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
