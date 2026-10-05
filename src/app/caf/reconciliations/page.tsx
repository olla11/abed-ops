import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUT_LABEL = { label: 'À valider (CAF)', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' }

// Même logique que la page AAF : une fois validé par la CAF, le dossier
// disparaissait de cette page dès qu'il passait au DE — plus aucune trace.
const STATUT_APRES_CAF: Record<string, { label: string; color: string; bg: string; border: string }> = {
  reconciliation_de: { label: 'Transmise à la DE', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  cloture: { label: 'Clôturée (autorisée par la DE)', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
}

export default async function CAFReconciliationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: missions }, { data: historique }] = await Promise.all([
    supabase
      .from('missions')
      .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
      .eq('status', 'reconciliation_caf')
      .order('date_retour', { ascending: true }),
    supabase
      .from('missions')
      .select('id, reference, objet, lieu, status, reconciliation_caf_valide_le, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms), valide_par:profiles!missions_reconciliation_caf_valide_par_fkey(nom, prenoms)')
      .in('status', ['reconciliation_de', 'cloture'])
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Réconciliations d&apos;ordres de mission</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Réconciliations validées par l&apos;AAF, en attente de votre validation (étape CAF),
        avant autorisation du DE.
      </p>

      {(!missions || missions.length === 0) ? (
        <div className="card">
          <p style={{ color: 'var(--abed-muted)' }}>Aucune réconciliation en attente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {missions.map((m: any) => (
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
                fontSize: 12, fontWeight: 700, color: STATUT_LABEL.color, background: STATUT_LABEL.bg,
                border: `1px solid ${STATUT_LABEL.border}`, borderRadius: 20, padding: '3px 12px',
              }}>
                {STATUT_LABEL.label}
              </span>
            </Link>
          ))}
        </div>
      )}

      {historique && historique.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 15, color: '#374151', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} strokeWidth={2} color="#166534" /> Déjà validées (historique)
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
            Les 50 dernières réconciliations déjà validées par la CAF, pour suivre où elles en sont ensuite.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historique.map((m: any) => {
              const st = STATUT_APRES_CAF[m.status] ?? { label: m.status, color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' }
              return (
                <Link key={m.id} href={`/missions/${m.id}`} className="card" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  textDecoration: 'none', color: 'inherit', padding: '12px 18px', opacity: 0.9,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      {m.objet} {m.reference ? <span style={{ color: 'var(--abed-muted)', fontWeight: 400 }}>· {m.reference}</span> : null}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--abed-muted)', marginTop: 2 }}>
                      {m.missionnaire?.prenoms} {m.missionnaire?.nom} — {m.lieu}
                      {' — validée '}
                      {m.valide_par ? `par ${m.valide_par.prenoms} ${m.valide_par.nom}` : ''}
                      {m.reconciliation_caf_valide_le
                        ? ` le ${new Date(m.reconciliation_caf_valide_le).toLocaleDateString('fr-FR')}`
                        : (m.valide_par ? '' : ' (date non disponible — avant la mise en place de ce suivi)')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg,
                    border: `1px solid ${st.border}`, borderRadius: 20, padding: '3px 12px', whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
