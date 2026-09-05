export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import SignaturesJournalClient from './SignaturesJournalClient'

// Historique complet des demandes de signature — réservé à admin et
// superadmin. Contrairement à /signatures (qui ne montre à chacun que ses
// propres demandes/signatures en attente), cette page conserve la trace de
// toute demande passée, signée ou non, y compris une fois entièrement
// complétée : sur /signatures un document signé "disparaît" des listes
// actives, alors qu'ici il reste visible avec la date et l'heure de chaque
// signature.
export default async function AdminSignaturesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(me?.role ?? '')) redirect('/admin/comptes')

  const admin = createAdminClient()
  const { data: demandes, error } = await admin
    .from('demandes_signature')
    .select(`
      id, titre, description, statut, type, created_at, updated_at, createur_id,
      createur:profiles!demandes_signature_createur_id_fkey(nom, prenoms),
      signataires(id, profile_id, email, nom_externe, signe, signe_le, refuse, refuse_le, refuse_motif, ordre, est_observateur,
        profile:profiles!signataires_profile_id_fkey(nom, prenoms))
    `)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) console.error('[admin/signatures] échec récupération demandes:', error)

  return <SignaturesJournalClient demandes={(demandes ?? []) as any[]} />
}
