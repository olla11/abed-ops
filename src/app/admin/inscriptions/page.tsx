export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import InscriptionsClient from './InscriptionsClient'

export default async function InscriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'rh'].includes(me.role)) redirect('/accueil')

  const { data: pending } = await supabase
    .from('profiles')
    .select('id, civilite, nom, prenoms, email, telephone, fonction, adresse, date_naissance, lieu_naissance, nationalite, created_at')
    .eq('registration_status', 'pending_activation')
    .order('created_at', { ascending: true })

  const { data: managers } = await supabase
    .from('profiles')
    .select('id, nom, prenoms, role')
    .in('role', ['manager', 'rh', 'admin', 'de', 'caf', 'aaf', 'administrateur'])
    .is('registration_status', null)
    .eq('archived', false)
    .order('nom')

  return (
    <InscriptionsClient
      pending={pending ?? []}
      managers={managers ?? []}
      adminRole={me.role}
    />
  )
}
