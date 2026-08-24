import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CalendrierClient from './CalendrierClient'

export const dynamic = 'force-dynamic'

export default async function CalendrierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: opportunites } = await supabase
    .from('opportunites_bd')
    .select('id, titre, bailleur, statut, date_limite')
    .not('date_limite', 'is', null)
    .order('date_limite', { ascending: true })

  return <CalendrierClient opportunites={(opportunites ?? []) as any} />
}
