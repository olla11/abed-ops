export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BaremesClient from './BaremesClient'

export default async function BaremesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Seul le CAF fixe les prix (+ admin/superadmin en secours technique).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['caf', 'admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  return <BaremesClient />
}
