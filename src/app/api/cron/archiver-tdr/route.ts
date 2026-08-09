import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// Appelée par Vercel Cron (vercel.json) une fois par an, le 31 janvier.
// Archive les TDR clôturés de l'année civile précédente — ils restent
// consultables (onglet "Archives"), seulement retirés de "Tous les TDR
// actifs". Sécurisée par le même secret que les autres cron.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('archiver_tdrs_annee_precedente')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, tdrs_archives: data })
}
