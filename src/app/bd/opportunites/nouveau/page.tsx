import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import NouvelleOpportuniteForm from './NouvelleOpportuniteForm'

export const dynamic = 'force-dynamic'

export default async function NouvelleOpportunitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profils } = await supabase
    .from('profiles').select('id, nom, prenoms').order('nom')

  return <NouvelleOpportuniteForm personnes={profils ?? []} />
}
