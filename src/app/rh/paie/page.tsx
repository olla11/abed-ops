import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getCachedProfile, getCachedContrats } from '@/lib/cache'
import PaieClient from './PaieClient'

export const dynamic = 'force-dynamic'

type Tranche = { jusqua: number | null; taux: number }

const DEFAUT_BAREME: Tranche[] = [
  { jusqua: 60000, taux: 0 },
  { jusqua: 130000, taux: 10 },
  { jusqua: 280000, taux: 15 },
  { jusqua: 530000, taux: 20 },
  { jusqua: null, taux: 25 },
]

export default async function PaiePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const me = await getCachedProfile(user.id)
  if (!['rh', 'admin'].includes(me?.role ?? '')) redirect('/rh/conges')

  const [contrats, { data: params }] = await Promise.all([
    getCachedContrats(),
    supabase.from('parametres').select('cle, valeur').in('cle', ['taux_cnss_employe', 'bareme_its']),
  ])

  const contratsActifs = (contrats ?? []).filter((c: any) => c.statut === 'actif')

  const tauxCnss = Number(params?.find(p => p.cle === 'taux_cnss_employe')?.valeur ?? 3.6)
  let bareme = DEFAUT_BAREME
  try {
    const raw = params?.find(p => p.cle === 'bareme_its')?.valeur
    if (raw) bareme = JSON.parse(raw)
  } catch { /* garde le barème par défaut si JSON invalide */ }

  return <PaieClient contrats={contratsActifs as any[]} tauxCnss={tauxCnss} bareme={bareme} />
}
