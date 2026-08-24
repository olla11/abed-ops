import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ValidationTimesheetsDE from '@/components/ValidationTimesheetsDE'

export const dynamic = 'force-dynamic'

export default async function DETimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Timesheets</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Validées par la CAF, en attente de votre autorisation finale (étape DE) avant paiement.
      </p>
      <ValidationTimesheetsDE userId={user.id} />
    </div>
  )
}
