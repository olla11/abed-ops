export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BackfillBcPdfClient from './BackfillBcPdfClient'

// Page ponctuelle (à supprimer après usage) : remplace le PDF simplifié des
// bons de commande historiques par le vrai rendu (même moteur que
// l'application) — voir /api/admin/backfill-bc-pdf.
export default async function BackfillBcPdfPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  return (
    <div className="page-container">
      <BackfillBcPdfClient />
    </div>
  )
}
