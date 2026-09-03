import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { genererSlug, slugValide } from '@/lib/presence'

async function verifierAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) return null
  return user
}

// PATCH — trois usages distincts, un seul champ à la fois dans le corps :
//   { action: 'personnaliser', slug }   — l'admin choisit le texte du lien
//   { action: 'regenerer' }             — nouveau lien aléatoire (invalide l'ancien, donc l'ancien QR)
//   { questions }, { motifs }           — configuration du formulaire
export async function PATCH(req: NextRequest) {
  const user = await verifierAdmin()
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data: config } = await admin.from('presence_config').select('id').order('updated_at', { ascending: false }).limit(1).single()
  if (!config) return NextResponse.json({ error: 'Configuration introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.action === 'personnaliser') {
    const slug = (body.slug ?? '').trim().toLowerCase()
    if (!slugValide(slug)) {
      return NextResponse.json({ error: 'Le lien doit contenir 3 à 50 caractères : lettres minuscules, chiffres et tirets uniquement.' }, { status: 400 })
    }
    updates.slug = slug
  } else if (body.action === 'regenerer') {
    updates.slug = genererSlug()
  } else {
    if ('questions' in body) updates.questions = body.questions
    if ('motifs' in body) updates.motifs = body.motifs
  }

  const { data: updated, error } = await admin.from('presence_config').update(updates).eq('id', config.id).select().single()
  if (error) {
    // Contrainte d'unicité sur slug — message clair plutôt que l'erreur SQL brute.
    if (error.code === '23505') return NextResponse.json({ error: 'Ce lien est déjà utilisé, choisissez-en un autre.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/admin/presence')
  return NextResponse.json({ config: updated })
}
