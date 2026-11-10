import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedPersonnel } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import BadgeConfigurationClient from './BadgeConfigurationClient'

export const dynamic = 'force-dynamic'

export default async function BadgeConfigurationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || ['admin', 'superadmin'].includes(me?.role ?? ''))) redirect('/rh/conges')

  const [personnel, { data: seuilRow }] = await Promise.all([
    getCachedPersonnel(),
    supabase.from('parametres').select('valeur').eq('cle', 'badge_seuil_jours_rappel').maybeSingle(),
  ])

  return (
    <BadgeConfigurationClient
      personnel={personnel as any[]}
      seuilInitial={Number(seuilRow?.valeur) || 3}
    />
  )
}
