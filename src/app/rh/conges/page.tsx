import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedCongesRH, getCachedSoldesCongesRH, getCachedPersonnel, getCachedTypesConge } from '@/lib/cache'
import { estRH } from '@/lib/roles'
import CongesRHClient from './CongesRHClient'

export const dynamic = 'force-dynamic'

export default async function CongesRHPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Cette page était la seule du dossier RH sans contrôle d'accès : n'importe
  // quel rôle authentifié pouvait y arriver directement par URL. Alignée sur
  // les autres pages RH (lecture fraîche, jamais getCachedProfile).
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = me?.role ?? ''
  if (!(estRH(role) || ['admin', 'superadmin', 'de', 'dp', 'administrateur'].includes(role))) redirect('/dashboard')

  const [conges, soldes, personnel, typesConge] = await Promise.all([
    getCachedCongesRH(), getCachedSoldesCongesRH(), getCachedPersonnel(), getCachedTypesConge(),
  ])

  return <CongesRHClient conges={conges as any[]} soldes={soldes as any[]} personnel={personnel as any[]} typesConge={typesConge as any[]} role={role} />
}
