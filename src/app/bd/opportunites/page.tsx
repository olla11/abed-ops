import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { estBD } from '@/lib/roles'
import OpportunitesListClient from './OpportunitesListClient'

export const dynamic = 'force-dynamic'

export default async function OpportunitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('titre, role').eq('id', user.id).single()
  const peutGerer = estBD(profile?.titre) || ['admin', 'superadmin'].includes(profile?.role ?? '')

  const { data: opportunites } = await supabase
    .from('opportunites_bd')
    .select('id, titre, bailleur, statut, date_identification, date_limite, date_soumission, identifie_par:profiles!opportunites_bd_identifie_par_fkey(nom, prenoms)')
    .order('date_identification', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Opportunités</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
            Registre des appels à projets, du début de l&apos;appel jusqu&apos;à la réponse du bailleur.
          </p>
        </div>
        {peutGerer && (
          <a href="/bd/opportunites/nouveau" className="btn" style={{ fontSize: 13 }}>+ Nouvelle opportunité</a>
        )}
      </div>
      <OpportunitesListClient opportunites={(opportunites ?? []) as any} />
    </div>
  )
}
