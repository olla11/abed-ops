export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GestionTitres from '@/components/GestionTitres'

export default async function TitresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  // Réservé à admin/superadmin — retiré du menu Administration de la CAF.
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  return (
    <div className="card page-container">
      <h3 style={{ marginBottom: 16, fontSize: 15 }}>Attribuer un titre / rôle</h3>
      <GestionTitres />
    </div>
  )
}
