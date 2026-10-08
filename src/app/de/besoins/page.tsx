import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TraitementExpressionsBesoin from '@/components/TraitementExpressionsBesoin'

export const dynamic = 'force-dynamic'

export default async function DEBesoinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Expressions de besoin</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Fiches validées par l'AAF, en attente de votre autorisation finale.
      </p>
      <TraitementExpressionsBesoin role={profile?.role ?? ''} userId={user.id} hideMesDemandes stage="de" />
    </div>
  )
}
