import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUT_LABEL = { label: 'À autoriser (DE)', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' }

export default async function DEReconciliationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: missions }, { data: historique }] = await Promise.all([
    supabase
      .from('missions')
      .select('id, reference, objet, lieu, date_depart, date_retour, status, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms)')
      .eq('status', 'reconciliation_de')
      .order('date_retour', { ascending: true }),
    // Une fois autorisée par la DE, la mission se clôture et disparaissait de
    // cette page — aucune trace de ce qui avait déjà été autorisé. On
    // retrouve ici les 50 dernières, avec qui/quand (reconciliation_de_valide_par/le,
    // renseigné à chaque autorisation depuis ce correctif — NULL pour les
    // dossiers clôturés avant, faute de pouvoir reconstituer une date exacte,
    // ou clôturés par une autre voie que ce circuit AAF→CAF→DE).
    supabase
      .from('missions')
      .select('id, reference, objet, lieu, status, solde_missionnaire, a_charge_partenaire, mode_financement, reconciliation_de_valide_le, missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms), valide_par:profiles!missions_reconciliation_de_valide_par_fkey(nom, prenoms)')
      .eq('status', 'cloture')
      .not('reconciliation_de_valide_le', 'is', null)
      .order('reconciliation_de_valide_le', { ascending: false })
      .limit(50),
  ])

  return (
    <div>
      <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px' }}>Réconciliations d&apos;ordres de mission</h2>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '0 0 20px' }}>
        Réconciliations validées par la CAF, en attente de votre autorisation finale (étape DE) avant clôture.
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
            <CheckCircle2 size={16} strokeWidth={2} color="#166534" /> Déjà autorisées (historique)
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--abed-muted)', margin: '0 0 14px' }}>
            Les 50 dernières réconciliations déjà autorisées et clôturées. Un montant encore dû par
            ABED a été envoyé automatiquement en Pay Roll pour paiement (missions sur crédit ou avance).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historique.map((m: any) => {
              // Même formule que côté serveur (valider-reconciliation-de/route.ts) :
              // solde_missionnaire négatif = ABED doit encore verser ce montant.
              const montantDu = (!m.a_charge_partenaire && m.mode_financement !== 'totalite_avant')
                ? Math.max(0, -(m.solde_missionnaire ?? 0))
                : 0
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
                    {' — autorisée '}
                    {m.valide_par ? `par ${m.valide_par.prenoms} ${m.valide_par.nom} ` : ''}
                    {m.reconciliation_de_valide_le ? `le ${new Date(m.reconciliation_de_valide_le).toLocaleDateString('fr-FR')}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, color: '#166534', background: '#f0fdf4',
                  border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 12px', whiteSpace: 'nowrap',
                }}>
                  {montantDu > 0 ? 'Clôturée — envoyée en Pay Roll' : 'Clôturée'}
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
