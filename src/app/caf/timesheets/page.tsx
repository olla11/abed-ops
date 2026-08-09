import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ValidationCAF from '@/components/ValidationCAF'

export const dynamic = 'force-dynamic'

export default async function CAFTimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Timesheets & paiements</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Validation financière des timesheets et gestion des paiements — étape exclusivement CAF,
        sans passage par l&apos;AAF.
      </p>
      <ValidationCAF />
    </div>
  )
}
