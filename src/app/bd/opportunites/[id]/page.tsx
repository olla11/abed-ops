import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import { estBD } from '@/lib/roles'
import OpportuniteDetailClient from './OpportuniteDetailClient'

export const dynamic = 'force-dynamic'

export default async function OpportuniteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  const peutGerer = estBD(profile?.titre) || ['admin', 'superadmin'].includes(profile?.role ?? '')

  const [{ data: opportunite }, { data: personnes }] = await Promise.all([
    supabase
      .from('opportunites_bd')
      .select('*, identifie_par:profiles!opportunites_bd_identifie_par_fkey(nom, prenoms), responsable:profiles!opportunites_bd_responsable_id_fkey(nom, prenoms)')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('id, nom, prenoms').order('nom'),
  ])

  if (!opportunite) notFound()

  return <OpportuniteDetailClient opportunite={opportunite as any} peutGerer={peutGerer} personnes={personnes ?? []} />
}
