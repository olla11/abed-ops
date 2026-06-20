'use client'
import { useRouter } from 'next/navigation'

type Props = {
  prenom: string
  role: string
  roleLabel: string
  fonction: string | null
  omEnCours: number
  congesEnAttente: number
  demandesEnCours: number
  notifsNonLues: number
}

const ROLE_SHORTCUTS: Record<string, { href: string; icon: string; label: string; desc: string }[]> = {
  admin: [
    { href: '/overview', icon: '📊', label: 'Vue d\'ensemble', desc: 'Tableau de bord global' },
    { href: '/missions', icon: '✈️', label: 'Ordres de mission', desc: 'Gérer les missions' },
    { href: '/demandes-paiement', icon: '💳', label: 'Paiements', desc: 'Demandes en cours' },
    { href: '/conges', icon: '🏖', label: 'Congés', desc: 'Suivi des congés' },
    { href: '/rh', icon: '👥', label: 'RH', desc: 'Tableau de bord RH' },
    { href: '/admin', icon: '🛠️', label: 'Administration', desc: 'Gestion système' },
  ],
  rh: [
    { href: '/rh', icon: '👥', label: 'Tableau de bord RH', desc: 'Vue globale RH' },
    { href: '/conges', icon: '🏖', label: 'Congés', desc: 'Demandes de congé' },
    { href: '/timesheets', icon: '⏱', label: 'Feuilles de temps', desc: 'Suivi activités' },
    { href: '/missions', icon: '✈️', label: 'Missions', desc: 'Ordres de mission' },
  ],
  caf: [
    { href: '/demandes-paiement', icon: '💳', label: 'Demandes de paiement', desc: 'Validation CAF' },
    { href: '/timesheets', icon: '⏱', label: 'Feuilles de temps', desc: 'Livrables & taux' },
    { href: '/parametres', icon: '⚙️', label: 'Paramètres', desc: 'Configuration financière' },
    { href: '/overview', icon: '📊', label: 'Vue d\'ensemble', desc: 'Tableau de bord' },
  ],
  de: [
    { href: '/overview', icon: '📊', label: 'Vue d\'ensemble', desc: 'Tableau de bord' },
    { href: '/missions', icon: '✈️', label: 'Missions', desc: 'Signature & validation' },
    { href: '/demandes-paiement', icon: '💳', label: 'Paiements', desc: 'Autorisation finale' },
    { href: '/conges', icon: '🏖', label: 'Congés', desc: 'Approbation finale' },
  ],
  aaf: [
    { href: '/demandes-paiement', icon: '💳', label: 'Demandes de paiement', desc: 'Validation AAF' },
    { href: '/overview', icon: '📊', label: 'Vue d\'ensemble', desc: 'Tableau de bord' },
    { href: '/missions', icon: '✈️', label: 'Missions', desc: 'Ordres de mission' },
  ],
  administrateur: [
    { href: '/overview', icon: '📊', label: 'Vue d\'ensemble', desc: 'Tableau de bord' },
    { href: '/missions', icon: '✈️', label: 'Missions', desc: 'Ordres de mission' },
    { href: '/demandes-paiement', icon: '💳', label: 'Paiements', desc: 'Demandes en cours' },
  ],
  manager: [
    { href: '/timesheets', icon: '⏱', label: 'Feuilles de temps', desc: 'Valider les feuilles' },
    { href: '/conges', icon: '🏖', label: 'Congés', desc: 'Valider les congés' },
    { href: '/missions', icon: '✈️', label: 'Missions', desc: 'Ordres de mission' },
  ],
  missionnaire: [
    { href: '/missions', icon: '✈️', label: 'Mes missions', desc: 'Ordres de mission' },
    { href: '/demandes-paiement', icon: '💳', label: 'Mes demandes', desc: 'Demandes de paiement' },
    { href: '/conges', icon: '🏖', label: 'Mes congés', desc: 'Demandes de congé' },
    { href: '/timesheets', icon: '⏱', label: 'Mes feuilles', desc: 'Feuilles de temps' },
  ],
  prestataire: [
    { href: '/timesheets', icon: '⏱', label: 'Feuilles de temps', desc: 'Mes activités' },
    { href: '/demandes-paiement', icon: '💳', label: 'Mes demandes', desc: 'Demandes de paiement' },
    { href: '/missions', icon: '✈️', label: 'Mes missions', desc: 'Ordres de mission' },
  ],
}

function getGreeting(): { text: string; sub: string } {
  const h = new Date().getHours()
  if (h >= 0 && h < 5)  return { text: 'Bonne nuit', sub: 'Vous brûlez l\'huile de minuit... prenez soin de vous !' }
  if (h >= 5 && h < 9)  return { text: 'Bonjour', sub: 'Bonne matinée, belle journée en perspective !' }
  if (h >= 9 && h < 12) return { text: 'Bonjour', sub: 'La journée est bien lancée, bonne productivité !' }
  if (h >= 12 && h < 14) return { text: 'Bon appétit', sub: 'C\'est l\'heure de la pause déjeuner !' }
  if (h >= 14 && h < 18) return { text: 'Bon après-midi', sub: 'L\'élan de l\'après-midi, continuez comme ça !' }
  if (h >= 18 && h < 21) return { text: 'Bonsoir', sub: 'La journée tire à sa fin, bien joué !' }
  return { text: 'Bonsoir', sub: 'Il se fait tard... reposez-vous bientôt !' }
}

export default function AccueilClient({ prenom, role, roleLabel, fonction, omEnCours, congesEnAttente, demandesEnCours, notifsNonLues }: Props) {
  const router = useRouter()
  const shortcuts = ROLE_SHORTCUTS[role] ?? ROLE_SHORTCUTS['missionnaire']
  const greeting = getGreeting()

  const stats = [
    { icon: '✈️', label: 'Missions en cours', value: omEnCours, href: '/missions', color: '#1e40af', bg: '#dbeafe' },
    { icon: '💳', label: 'Demandes en cours', value: demandesEnCours, href: '/demandes-paiement', color: '#6d28d9', bg: '#ede9fe' },
    { icon: '🏖', label: 'Congés en attente', value: congesEnAttente, href: '/conges', color: '#b45309', bg: '#fef3c7' },
    { icon: '🔔', label: 'Notifications', value: notifsNonLues, href: '/notifications', color: '#991b1b', bg: '#fee2e2' },
  ]

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero welcome */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
        borderRadius: 20, padding: '40px 48px', marginBottom: 32, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -50, right: 80, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 6px', fontWeight: 500 }}>
            {greeting.text},
          </p>
          <h1 style={{ color: 'white', fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.5 }}>
            {prenom || 'Bienvenue'} 👋
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: '0 0 4px' }}>
            {greeting.sub}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
            {fonction ? fonction : roleLabel}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map(s => (
          <button
            key={s.label}
            onClick={() => router.push(s.href)}
            style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 16, padding: '20px 22px',
              textAlign: 'left', cursor: 'pointer', transition: 'box-shadow 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{s.icon}</div>
              <div style={{
                background: s.bg, color: s.color, borderRadius: 999,
                padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {s.value}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Quick access */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 16 }}>Accès rapide</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {shortcuts.map(s => (
            <button
              key={s.href}
              onClick={() => router.push(s.href)}
              style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 14,
                padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--abed-green)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(6,95,70,0.10)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ fontSize: 28, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
