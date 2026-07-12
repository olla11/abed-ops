import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import { formatSignatureDisplayName } from '@/lib/signature-name'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const prenoms = typeof body?.prenoms === 'string' ? body.prenoms.trim() : ''
  const nom = typeof body?.nom === 'string' ? body.nom.trim() : ''

  if (!prenoms || !nom) {
    return NextResponse.json({ error: 'Nom et prénom requis' }, { status: 400 })
  }

  const payload = verifyExternalSignerToken(token)
  if (!payload) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 401 })

  const admin = createAdminClient()

  const { data: signataire, error } = await admin
    .from('signataires')
    .select('id, email, signe')
    .eq('id', payload.signataireId)
    .single()

  if (error || !signataire || signataire.email !== payload.email) {
    return NextResponse.json({ error: 'Signataire introuvable' }, { status: 404 })
  }
  if (signataire.signe) {
    return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })
  }

  const nomExterne = formatSignatureDisplayName(prenoms, nom)
  const { error: updateErr } = await admin
    .from('signataires')
    .update({ nom_externe: nomExterne })
    .eq('id', signataire.id)

  if (updateErr) {
    console.error('[Signatures externe] update nom error:', updateErr)
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nomExterne })
}
