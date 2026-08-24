import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { calendrierBucket, CALENDRIER_BUCKET_LABELS, CALENDRIER_BUCKET_COLORS, type CalendrierBucket, type OpportuniteStatut } from '@/lib/bd'

export const dynamic = 'force-dynamic'

const BUCKETS: CalendrierBucket[] = ['en_retard', 'a_faire', 'en_attente', 'termine']

export default async function CalendrierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: opportunites } = await supabase
    .from('opportunites_bd')
    .select('id, titre, bailleur, statut, date_limite, date_soumission')
    .order('date_limite', { ascending: true, nullsFirst: false })

  const parBucket: Record<CalendrierBucket, typeof opportunites> = { en_retard: [], a_faire: [], en_attente: [], termine: [] } as any
  for (const o of opportunites ?? []) {
    const bucket = calendrierBucket(o.statut as OpportuniteStatut, o.date_limite)
    parBucket[bucket]!.push(o)
  }

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Calendrier</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Les opportunités classées selon leur échéance et leur avancement.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
        {BUCKETS.map(bucket => (
          <div key={bucket} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px', background: CALENDRIER_BUCKET_COLORS[bucket] + '14',
              borderBottom: `2px solid ${CALENDRIER_BUCKET_COLORS[bucket]}`,
              fontWeight: 700, fontSize: 13, color: CALENDRIER_BUCKET_COLORS[bucket],
            }}>
              {CALENDRIER_BUCKET_LABELS[bucket]} ({parBucket[bucket]?.length ?? 0})
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
              {(parBucket[bucket] ?? []).length === 0 ? (
                <p style={{ fontSize: 12.5, color: '#9ca3af', padding: '8px 6px' }}>Aucune opportunité.</p>
              ) : (
                (parBucket[bucket] ?? []).map((o: any) => (
                  <Link key={o.id} href={`/bd/opportunites/${o.id}`} style={{
                    display: 'block', padding: '10px 12px', borderRadius: 8, border: '1px solid #f3f4f6',
                    background: '#fafafa', textDecoration: 'none', color: 'inherit',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.titre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--abed-muted)', marginTop: 2 }}>
                      {o.bailleur ?? 'Bailleur non précisé'}
                      {o.date_limite && ` — échéance ${new Date(o.date_limite).toLocaleDateString('fr-FR')}`}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
