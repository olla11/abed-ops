import { createClient } from '@/lib/supabase-server'
import { accordGenre } from '@/lib/genre'
import BonsDeCommandeClient from './BonsDeCommandeClient'

export const dynamic = 'force-dynamic'

export default async function BonsDeCommandePage() {
  const supabase = await createClient()
  const [{ data: de }, { data: pca }] = await Promise.all([
    supabase.from('profiles').select('civilite').eq('role', 'de').eq('archived', false).maybeSingle(),
    supabase.from('profiles').select('civilite').eq('titre', 'president_ca').eq('archived', false).maybeSingle(),
  ])
  const deTitre = accordGenre(de?.civilite, 'Directeur Exécutif', 'Directrice Exécutive')
  const pcaTitre = accordGenre(pca?.civilite, 'Président du Conseil d\'Administration', 'Présidente du Conseil d\'Administration')

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Bon de commande</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Émettez un bon de commande — il part en signature {accordGenre(de?.civilite, 'au', 'à la')} {deTitre} si le montant est
        inférieur à 3 000 000 FCFA, ou {accordGenre(pca?.civilite, 'au', 'à la')} {pcaTitre} au-delà.
      </p>
      <BonsDeCommandeClient deTitre={deTitre} pcaTitre={pcaTitre} />
    </div>
  )
}
