import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyContratExterneToken } from '@/lib/contrat-externe-token'
import { revalidateTag } from 'next/cache'

// Première étape du lien externe (voir /contrats/externe) : le destinataire
// n'a pas de compte, donc pas de profil dont tirer son nom — il le saisit
// lui-même avant d'accéder au document.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = body?.token ?? ''
  const prenoms = (body?.prenoms ?? '').trim()
  const nom = (body?.nom ?? '').trim()
  if (!prenoms || !nom) return NextResponse.json({ error: 'Prénom et nom sont requis.' }, { status: 400 })

  const payload = verifyContratExterneToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contrat } = await admin.from('contrats').select('id, destinataire_email, profile_id').eq('id', payload.contratId).single()
  if (!contrat || contrat.destinataire_email?.toLowerCase() !== payload.email.toLowerCase()) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 401 })
  }
  if (contrat.profile_id) {
    return NextResponse.json({ error: 'Ce document est désormais rattaché à un compte My ABED. Connectez-vous pour le consulter.' }, { status: 409 })
  }

  const { error } = await admin.from('contrats').update({ destinataire_prenoms: prenoms, destinataire_nom: nom }).eq('id', contrat.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('contrats')
  return NextResponse.json({ ok: true, prenoms, nom })
}
