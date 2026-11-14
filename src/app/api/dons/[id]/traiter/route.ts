import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { estAAF } from '@/lib/roles'
import { NOM_CLUB } from '@/lib/dons'

// Confirmation d'un don MoMo (type partenaire) après vérification de la
// capture jointe. Les dons "abandon_credit" n'ont rien à vérifier : ils sont
// confirmés automatiquement à la clôture de la mission (voir dons.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(estAAF(me?.role) || ['de', 'admin', 'superadmin'].includes(me?.role ?? ''))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { decision } = await req.json().catch(() => ({}))
  if (decision !== 'confirme' && decision !== 'rejete') {
    return NextResponse.json({ error: 'Décision invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: don } = await admin.from('dons')
    .select('id, profile_id, montant, type, statut, mission:missions(reference)').eq('id', id).single()
  if (!don) return NextResponse.json({ error: 'Don introuvable' }, { status: 404 })
  if (don.type !== 'partenaire' || don.statut !== 'declare') {
    return NextResponse.json({ error: 'Ce don a déjà été traité.' }, { status: 400 })
  }

  const { error } = await admin.from('dons').update({
    statut: decision, traite_par: user.id, traite_le: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reference = (don.mission as any)?.reference ?? ''
  await admin.from('notifications').insert(decision === 'confirme'
    ? {
        user_id: don.profile_id,
        titre: `Merci — bienvenue dans ${NOM_CLUB}`,
        message: `Votre don de ${Number(don.montant).toLocaleString('fr-FR')} F CFA (mission ${reference}) a été confirmé. Merci pour votre soutien à ABED !`,
        lien: '/abed-heritage',
      }
    : {
        user_id: don.profile_id,
        titre: 'Don non confirmé',
        message: `Le paiement de votre don pour la mission ${reference} n'a pas pu être vérifié. Contactez l'AAF si vous avez bien effectué le versement.`,
        lien: '/abed-heritage',
      })

  return NextResponse.json({ ok: true })
}
