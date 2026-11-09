export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BadgeParametresForm from './BadgeParametresForm'

export default async function BadgeParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  const { data } = await supabase
    .from('parametres').select('cle, valeur')
    .in('cle', ['badge_bureau_latitude', 'badge_bureau_longitude', 'badge_rayon_metres'])
  const map = Object.fromEntries((data ?? []).map(r => [r.cle, r.valeur]))

  return (
    <div className="page-container" style={{ maxWidth: 520 }}>
      <h2 style={{ color: 'var(--abed-green)', marginBottom: 6 }}>Badgeage bureau</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 24 }}>
        Position GPS du bureau et rayon maximal autorisé pour que le badgeage d&apos;entrée/sortie soit accepté.
      </p>
      <BadgeParametresForm
        latitude={map.badge_bureau_latitude ?? ''}
        longitude={map.badge_bureau_longitude ?? ''}
        rayonMetres={map.badge_rayon_metres ?? '50'}
      />
    </div>
  )
}
