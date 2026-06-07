export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import TimesheetsClient from '@/components/TimesheetsClient'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nom, prenoms, manager_id, type_emploi, email')
    .eq('id', user.id).single()

  const role = profile?.role ?? 'missionnaire'
  const typeEmploi = profile?.type_emploi ?? null

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'grid', gap: 28 }}>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={role}
        typeEmploi={typeEmploi}
        showAdmin={role === 'admin'}
      />
      <TimesheetsClient
        role={role}
        typeEmploi={typeEmploi}
        managerId={profile?.manager_id ?? null}
        estRapportMensuel={['benevole', 'stagiaire_n1', 'stagiaire_n2', 'cdd', 'cdi'].includes(typeEmploi ?? '')}
        estManager={['manager', 'caf', 'admin', 'de', 'aaf'].includes(role)}
        estCAF={['caf', 'admin'].includes(role)}
        estAAF={['aaf', 'admin'].includes(role)}
        estSalarie={['cdd', 'cdi'].includes(typeEmploi ?? '')}
      />
    </div>
  )
}
