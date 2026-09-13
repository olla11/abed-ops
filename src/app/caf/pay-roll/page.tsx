import { createClient } from '@/lib/supabase-server'
import { accordGenre } from '@/lib/genre'
import PayRollClient from './PayRollClient'

export const dynamic = 'force-dynamic'

export default async function CAFPayRollPage() {
  const supabase = await createClient()
  const { data: de } = await supabase.from('profiles').select('civilite').eq('role', 'de').eq('archived', false).maybeSingle()
  const leLaDirecteur = accordGenre(de?.civilite, 'le Directeur Exécutif', 'la Directrice Exécutive')

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Pay Roll</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Tous les paiements autorisés par {leLaDirecteur} (demandes simples, allocations,
        timesheets, réconciliations de mission) — passez le statut à « À payer » en choisissant
        le compte, puis générez un appel de fonds pour lancer la signature.
      </p>
      <PayRollClient />
    </div>
  )
}
