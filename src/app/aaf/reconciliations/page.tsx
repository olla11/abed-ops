import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  reconciliation_aaf: { label: 'À valider (AAF)', color: '#92660b', bg: '#fffbeb', border: '#fde68a' },
  reconciliation_caf: { label: 'À valider (CAF)', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
}

export default async function AAFReconciliationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
    .in('status', ['reconciliation_aaf', 'reconciliation_caf'])
    .order('date_retour', { ascending: true })

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Réconciliations d&apos;ordres de mission</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Réconciliations soumises par les missionnaires, en attente de votre validation (étape AAF ou CAF
        selon votre rôle), avant transmission à l&apos;étape suivante.
      </p>

      {(!missions || missions.length === 0) ? (
        <div className="card">
          <p style={{ color: 'var(--abed-muted)' }}>Aucune réconciliation en attente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {missions.map((m: any) => {
            const st = STATUT_LABEL[m.status] ?? { label: 'À valider', color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' }
            return (
              <Link key={m.id} href={`/missions/${m.id}`} className="card" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textDecoration: 'none', color: 'inherit', padding: '14px 18px',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {m.objet} {m.reference ? <span style={{ color: 'var(--abed-muted)', fontWeight: 400 }}>· {m.reference}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 2 }}>
                    {m.missionnaire?.prenoms} {m.missionnaire?.nom} — {m.lieu}
                    {m.date_retour && ` — retour le ${new Date(m.date_retour).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: st.color, background: st.bg,
                  border: `1px solid ${st.border}`, borderRadius: 20, padding: '3px 12px',
                }}>
                  {st.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
