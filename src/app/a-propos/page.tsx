export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { Info, Sprout, ShieldCheck, Mail } from 'lucide-react'
import pkg from '../../../package.json'
import { estAAF } from '@/lib/roles'

const FONCTIONNALITES = [
  'Ordres de mission & réconciliation',
  'Termes de référence (TdR) & signatures électroniques',
  'Timesheets & congés',
  'Contrats & évaluations RH',
  'Demandes de paiement & rapports d’allocation',
  'Projets, espaces collaboratifs & ressources',
]

export default async function AProposPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, titre, nom, prenoms, avatar_url, type_emploi').eq('id', user.id).single()

  const annee = new Date().getFullYear()

  return (
    <>
      <AppHeader
        userName={`${profile?.prenoms ?? ''} ${profile?.nom ?? ''}`}
        userRole={profile?.role ?? ''}
        userTitre={profile?.titre}
        typeEmploi={profile?.type_emploi}
        showAAF={estAAF(profile?.role ?? '')}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="page-container" style={{ maxWidth: 720 }}>
        <h2 style={{ color: 'var(--abed-green)', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={22} /> À propos
        </h2>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sprout size={26} color="var(--abed-green)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>My ABED</h3>
              <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Version {pkg.version}</span>
            </div>
          </div>
          <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, margin: 0 }}>
            My ABED est la plateforme de gestion administrative interne d&apos;ABED-ONG (Agriculture pour le
            Bien-être et le Développement Durable) : missions, ressources humaines, finances et projets,
            dans un seul outil accessible à toute l&apos;équipe.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>Fonctionnalités principales</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: '#374151', lineHeight: 1.9 }}>
            {FONCTIONNALITES.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} color="var(--abed-green)" /> Confidentialité
          </h3>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', lineHeight: 1.7, margin: '0 0 12px' }}>
            Les données saisies dans My ABED servent exclusivement à la gestion des activités d&apos;ABED-ONG.
            Les communications ciblées de l&apos;administration reposent sur des préférences que vous choisissez
            vous-même depuis votre profil, et que vous pouvez modifier à tout moment.
          </p>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Mail size={14} />
            <a href="mailto:contact@abedong.org" style={{ color: 'var(--abed-blue)' }}>contact@abedong.org</a>
          </p>
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>
          © {annee} ABED-ONG — Tous droits réservés.
        </p>
      </div>
    </>
  )
}
