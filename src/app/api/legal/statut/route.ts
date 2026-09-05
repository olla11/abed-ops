import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { LEGAL_VERSION } from '@/lib/legal-content'

// Sans session (page publique, visiteur, signataire externe) : rien à
// accepter ici, la fenêtre de consentement ne concerne que les comptes.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ needsAcceptance: false })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('conditions_acceptees_version').eq('id', user.id).single()

  const needsAcceptance = profile?.conditions_acceptees_version !== LEGAL_VERSION
  return NextResponse.json({ needsAcceptance, version: LEGAL_VERSION })
}
