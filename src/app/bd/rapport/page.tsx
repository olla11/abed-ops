import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { estBD } from '@/lib/roles'
import RapportClient from './RapportClient'

export const dynamic = 'force-dynamic'

// Outil de travail de l'équipe BD uniquement — pas partagé avec les
// superviseurs en lecture seule (voir BDNav, qui n'affiche même pas le lien
// pour eux ; ce garde-fou couvre l'accès direct par URL).
export default async function RapportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('titre').eq('id', user.id).single()
  if (!estBD(profile?.titre)) redirect('/bd')

  return <RapportClient />
}
