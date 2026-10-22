export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { getCachedProfile } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import PersonnelDossierClient from '@/components/PersonnelDossierClient'
import ProfileQrCode from '@/components/ProfileQrCode'
import { buildProfileVCard } from '@/lib/profile-qr'

export default async function PersonnelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  const { data: profile } = await supabase
    .from('profiles').select('nom, prenoms, fonction, role, titre, email, telephone').eq('id', id).single()

  if (!profile) redirect('/rh/personnel')

  const qrDataUrl = await QRCode.toDataURL(
    buildProfileVCard({ nom: profile.nom ?? '', prenoms: profile.prenoms ?? '', titre: profile.titre, email: profile.email, telephone: profile.telephone ?? null }),
    { width: 320, margin: 1 }
  )

  return (
    <div className="page-container">
      <Link href="/rh/personnel" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', margin: '8px 0 4px' }}>
            Dossier — {profile.prenoms} {profile.nom}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 24 }}>
            {profile.fonction ?? '—'}
          </p>
        </div>
        <a
          href={`/api/fiche-personnel-pdf/${id}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'var(--abed-green)', color: 'white', textDecoration: 'none',
          }}
        >
          Télécharger la fiche PDF
        </a>
      </div>
      <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProfileQrCode dataUrl={qrDataUrl} fileName={`QR_${profile.prenoms}_${profile.nom}.png`.replace(/\s+/g, '_')} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ marginBottom: 6, fontSize: 15 }}>QR code d&apos;identification</h3>
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)' }}>
            Contient le nom, le poste à ABED-ONG et l&apos;email de {profile.prenoms} {profile.nom}.
          </p>
        </div>
      </div>

      <div className="card">
        <PersonnelDossierClient profileId={id} canDelete={true} />
      </div>
    </div>
  )
}
