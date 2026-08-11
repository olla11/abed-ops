import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ValidationRapportsAAF from '@/components/ValidationRapportsAAF'

export const dynamic = 'force-dynamic'

export default async function CAFRapportsAllocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Rapports d&apos;allocation</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Rapports traités par l&apos;AAF (montant fixé), en attente de votre validation (étape CAF),
        avant autorisation du DE. Les rapports soumis par l&apos;AAF lui-même apparaissent aussi
        directement ici, montant à fixer inclus — il ne peut pas traiter son propre dossier.
      </p>
      <ValidationRapportsAAF role={profile?.role ?? ''} userId={user.id} stage="caf" />
    </div>
  )
}
