import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TraitementDemandes from '@/components/TraitementDemandes'

export const dynamic = 'force-dynamic'

export default async function AAFDemandesPaiementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Demandes de paiement</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Demandes en attente de votre validation (étape AAF), avant transmission à la CAF.
      </p>
      <TraitementDemandes role={profile?.role ?? ''} userId={user.id} hideMesDemandes stage="aaf" />
    </div>
  )
}
