export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCachedProfile } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import PersonnelDossierClient from '@/components/PersonnelDossierClient'

export default async function PersonnelDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  const { data: profile } = await supabase
    .from('profiles').select('nom, prenoms, fonction, role').eq('id', id).single()

  if (!profile) redirect('/rh/personnel')

  return (
    <div className="page-container">
      <Link href="/rh/personnel" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
      <h2 style={{ color: 'var(--abed-green)', margin: '8px 0 4px' }}>
        Dossier — {profile.prenoms} {profile.nom}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 24 }}>
        {profile.fonction ?? '—'}
      </p>
      <div className="card">
        <PersonnelDossierClient profileId={id} canDelete={true} />
      </div>
    </div>
  )
}
