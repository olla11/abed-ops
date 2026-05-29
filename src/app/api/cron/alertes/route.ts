import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Appelée par Vercel Cron (vercel.json) une fois par jour.
// Sécurisée par un secret pour empêcher les appels externes.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('generer_alertes_delai')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // TODO : ici, parcourir les notifications créées aujourd'hui et envoyer les emails (Resend)
  return NextResponse.json({ ok: true, alertes_generees: data })
}
