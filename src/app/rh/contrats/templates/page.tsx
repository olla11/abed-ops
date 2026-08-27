import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { estRH } from '@/lib/roles'
import TemplatesClient from './TemplatesClient'

export const dynamic = 'force-dynamic'

export default async function ContratTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estRH(me?.role) || me?.role === 'admin')) redirect('/rh/conges')

  const service = createAdminClient()
  const { data: templates } = await service.from('contrat_templates').select('*').order('created_at', { ascending: false })

  return <TemplatesClient templates={(templates ?? []) as any[]} />
}
