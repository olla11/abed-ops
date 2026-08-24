import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUT_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  soumis: { label: 'À signer', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  brouillon: { label: 'Brouillon', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

export default async function DEOmASignerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Le DE signe les OM en règle générale — sauf les siens (il ne peut pas
  // s'auto-signer, seuls le CAF ou le Président du CA le font pour lui, voir
  // src/app/api/missions/[id]/signer/route.ts). On exclut donc les OM dont
  // le missionnaire est lui-même DE, en plus du garde-fou anti-auto-signature.
  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire_id, missionnaire:profiles!missions_missionnaire_id_fkey!inner(nom, prenoms, role)')
    .in('status', ['soumis', 'brouillon'])
    .neq('missionnaire.role', 'de')
    .order('date_depart', { ascending: true })

  const aSigner = (missions ?? []).filter((m: any) => m.missionnaire_id !== user.id)

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Ordres de mission à signer</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        OM soumis, en attente de votre signature.
      </p>

      {aSigner.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--abed-muted)' }}>Aucun OM en attente de signature.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {aSigner.map((m: any) => {
            const statut = STATUT_LABEL[m.status] ?? STATUT_LABEL.soumis
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
                    {m.date_depart && ` — départ le ${new Date(m.date_depart).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: statut.color, background: statut.bg,
                  border: `1px solid ${statut.border}`, borderRadius: 20, padding: '3px 12px',
                }}>
                  {statut.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
