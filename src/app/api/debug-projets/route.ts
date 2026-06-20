import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' })

  // Test 1: select projets_internes
  const t1 = await supabase.from('projets_internes').select('id, nom').limit(1)
  
  // Test 2: select activites
  const t2 = await supabase.from('activites').select('id').limit(1)
  
  // Test 3: select commentaires_activites
  const t3 = await supabase.from('commentaires_activites').select('id').limit(1)

  // Test 4: select projets_internes with first id
  const firstId = t1.data?.[0]?.id
  let t4: any = { data: null, error: 'no projet to test' }
  if (firstId) {
    t4 = await supabase
      .from('projets_internes')
      .select(`*, created_by_profile:profiles!projets_internes_created_by_fkey(id, nom, prenoms), activites(*, assignee:profiles!activites_assignee_id_fkey(id, nom, prenoms), commentaires_activites(id))`)
      .eq('id', firstId)
      .single()
  }

  return NextResponse.json({
    user_id: user.id,
    projets: { data: t1.data, error: t1.error?.message },
    activites: { data: t2.data, error: t2.error?.message },
    commentaires: { data: t3.data, error: t3.error?.message },
    detail_query: { data: t4.data ? '✓ OK' : null, error: t4.error?.message ?? t4.error },
  })
}
