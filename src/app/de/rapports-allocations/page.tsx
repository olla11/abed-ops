import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ValidationRapportsAAF from '@/components/ValidationRapportsAAF'

export const dynamic = 'force-dynamic'

export default async function DERapportsAllocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Rapports d&apos;allocation</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Rapports validés par la CAF, en attente de votre autorisation finale (étape DE).
      </p>
      <ValidationRapportsAAF role={profile?.role ?? ''} userId={user.id} stage="de" />
    </div>
  )
}
