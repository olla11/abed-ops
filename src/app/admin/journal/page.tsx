export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import JournalClient from './JournalClient'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') redirect('/admin/comptes')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, nom, prenoms, email, role')
    .eq('archived', false)
    .order('nom')

  return <JournalClient users={users ?? []} />
}
