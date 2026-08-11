export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GestionTitres from '@/components/GestionTitres'

export default async function TitresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  // Admin/superadmin : attribution complète (titre, type, ancienneté).
  // CAF : accès en lecture seule au titre/type — seule l'ancienneté (qui
  // fixe le taux du barème) lui est ouverte, c'est elle qui fixe les prix.
  if (!['admin', 'superadmin', 'caf'].includes(profile?.role ?? '')) redirect('/admin/comptes')
  const restreintCaf = profile?.role === 'caf'

  return (
    <div className="card page-container">
      <h3 style={{ marginBottom: 16, fontSize: 15 }}>
        {restreintCaf ? 'Ancienneté du personnel' : 'Attribuer un titre / rôle'}
      </h3>
      <GestionTitres restreintCaf={restreintCaf} />
    </div>
  )
}
