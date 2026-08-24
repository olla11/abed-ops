import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BDDashboardClient from './BDDashboardClient'

export const dynamic = 'force-dynamic'

export default async function BDDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: opportunites } = await supabase
    .from('opportunites_bd')
    .select('id, statut, bailleur, date_identification, date_soumission, montant_demande, montant_obtenu')
    .order('date_identification', { ascending: false })

  return <BDDashboardClient opportunites={opportunites ?? []} />
}
