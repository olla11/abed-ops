export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BackfillBcSignaturesClient from './BackfillBcSignaturesClient'

// Page ponctuelle (à supprimer après usage) : applique le tampon de
// signature sur les signataires des 11 bons de commande historiques —
// voir /api/admin/backfill-bc-signatures.
export default async function BackfillBcSignaturesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  return (
    <div className="page-container">
      <BackfillBcSignaturesClient />
    </div>
  )
}
