import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const QUOTA_GB = 1 // quota Supabase Storage Free tier = 1 GB

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifie' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'admin uniquement' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Lister tous les fichiers dans les buckets connus
  const buckets = ['assets', 'timesheets', 'livrables']
  let totalBytes = 0
  const details: Record<string, number> = {}

  for (const bucket of buckets) {
    try {
      // Supabase Storage list — récursif via prefix vide
      const { data: files } = await admin.storage.from(bucket).list('', { limit: 1000 })
      let bucketBytes = 0
      if (files) {
        for (const f of files) {
          if (f.metadata?.size) bucketBytes += f.metadata.size
        }
        // Récupérer aussi les sous-dossiers (niveau 1)
        for (const f of files) {
          if (!f.id) { // c'est un dossier
            const { data: subFiles } = await admin.storage.from(bucket).list(f.name, { limit: 1000 })
            for (const sf of subFiles ?? []) {
              if (sf.metadata?.size) bucketBytes += sf.metadata.size
            }
          }
        }
      }
      details[bucket] = bucketBytes
      totalBytes += bucketBytes
    } catch { details[bucket] = 0 }
  }

  // Compter les enregistrements
  const [missions, soumissions, profiles, payments] = await Promise.all([
    admin.from('missions').select('*', { count: 'exact', head: true }),
    admin.from('soumissions').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('payments').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    totalBytes,
    quotaBytes: QUOTA_GB * 1024 * 1024 * 1024,
    details,
    counts: {
      missions: missions.count ?? 0,
      soumissions: soumissions.count ?? 0,
      profiles: profiles.count ?? 0,
      payments: payments.count ?? 0,
    },
  })
}
