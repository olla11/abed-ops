import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

// Complète le formulaire d'inscription (ajouté après coup) : les comptes déjà
// actifs avant cette évolution n'ont jamais renseigné ces champs. On les
// invite à les compléter — mais pas le superadmin, qui n'est pas un membre
// du personnel suivi par ce mécanisme.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ needsCompletion: false })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles')
    .select('role, date_embauche, biographie, consentement_communication, avatar_url, archived')
    .eq('id', user.id).single()

  if (!profile || profile.role === 'superadmin' || profile.archived) {
    return NextResponse.json({ needsCompletion: false })
  }

  const [{ count: photoCount }, { count: idCount }] = await Promise.all([
    admin.from('personnel_documents').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('categorie', 'photo'),
    admin.from('personnel_documents').select('id', { count: 'exact', head: true }).eq('profile_id', user.id).eq('categorie', 'piece_identite'),
  ])

  const missing = {
    dateEmbauche: !profile.date_embauche,
    biographie: !profile.biographie,
    consentement: profile.consentement_communication === null,
    // Une personne qui a déjà un avatar (ancien flux d'inscription, ou
    // upload manuel dans Paramètres) n'a pas besoin de re-déposer une photo.
    photo: !profile.avatar_url && (photoCount ?? 0) === 0,
    pieceIdentite: (idCount ?? 0) === 0,
  }

  const needsCompletion = Object.values(missing).some(Boolean)
  return NextResponse.json({ needsCompletion, missing })
}
