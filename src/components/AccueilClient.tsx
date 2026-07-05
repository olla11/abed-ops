'use client'
import { useRouter } from 'next/navigation'
import { BarChart2, Plane, CreditCard, Palmtree, Users, Settings, Clock, Bell, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

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

type Shortcut = { href: string; Icon: LucideIcon; label: string; desc: string }

function buildShortcuts(t: (k: string) => string): Record<string, Shortcut[]> {
  return {
    admin: [
      { href: '/overview',          Icon: BarChart2,  label: t('overview'),       desc: t('shortcuts_desc') },
      { href: '/missions',          Icon: Plane,      label: t('missions'),        desc: t('missions_desc') },
      { href: '/demandes', Icon: CreditCard, label: t('payments'),        desc: t('payments_desc') },
      { href: '/conges',            Icon: Palmtree,   label: t('leaves'),          desc: t('leaves_desc') },
      { href: '/rh',                Icon: Users,      label: t('rh'),              desc: t('rh_desc') },
      { href: '/admin',             Icon: Settings,   label: t('admin'),           desc: t('admin_desc') },
    ],
    rh: [
      { href: '/rh',         Icon: Users,    label: t('rh'),        desc: t('rhDashboard_desc') },
      { href: '/conges',     Icon: Palmtree, label: t('leaves'),    desc: t('myLeaves_desc') },
      { href: '/timesheets', Icon: Clock,    label: t('timesheets'), desc: t('myTimesheets_desc') },
      { href: '/missions',   Icon: Plane,    label: t('missions'),   desc: t('missions_desc') },
    ],
    caf: [
      { href: '/demandes', Icon: CreditCard, label: t('payments'),    desc: t('cafValidation_desc') },
      { href: '/timesheets',        Icon: Clock,      label: t('timesheets'),  desc: t('livrables_desc') },
      { href: '/parametres',        Icon: Settings,   label: t('settings'),    desc: t('config_desc') },
      { href: '/overview',          Icon: BarChart2,  label: t('overview'),    desc: t('shortcuts_desc') },
    ],
    de: [
      { href: '/overview',          Icon: BarChart2,  label: t('overview'),  desc: t('shortcuts_desc') },
      { href: '/missions',          Icon: Plane,      label: t('missions'),  desc: t('signValidate_desc') },
      { href: '/demandes', Icon: CreditCard, label: t('payments'),  desc: t('finalApproval_desc') },
      { href: '/conges',            Icon: Palmtree,   label: t('leaves'),    desc: t('finalApprovalLeaves_desc') },
    ],
    aaf: [
      { href: '/demandes', Icon: CreditCard, label: t('payments'),  desc: t('aafValidation_desc') },
      { href: '/overview',          Icon: BarChart2,  label: t('overview'),  desc: t('shortcuts_desc') },
      { href: '/missions',          Icon: Plane,      label: t('missions'),  desc: t('missions_desc') },
    ],
    administrateur: [
      { href: '/overview',          Icon: BarChart2,  label: t('overview'),  desc: t('shortcuts_desc') },
      { href: '/missions',          Icon: Plane,      label: t('missions'),  desc: t('missions_desc') },
      { href: '/demandes', Icon: CreditCard, label: t('payments'),  desc: t('payments_desc') },
    ],
    manager: [
      { href: '/timesheets', Icon: Clock,    label: t('timesheets'), desc: t('validateTimesheets_desc') },
      { href: '/conges',     Icon: Palmtree, label: t('leaves'),     desc: t('validateLeaves_desc') },
      { href: '/missions',   Icon: Plane,    label: t('missions'),   desc: t('missions_desc') },
    ],
    missionnaire: [
      { href: '/missions',          Icon: Plane,      label: t('missionnaire_myMissions'),  desc: t('myMissions_desc') },
      { href: '/demandes', Icon: CreditCard, label: t('missionnaire_myPayments'),  desc: t('myPayments_desc') },
      { href: '/conges',            Icon: Palmtree,   label: t('missionnaire_myLeaves'),    desc: t('myLeaves_desc') },
      { href: '/timesheets',        Icon: Clock,      label: t('missionnaire_myTimesheets'), desc: t('myTimesheets_desc') },
    ],
    prestataire: [
      { href: '/timesheets',        Icon: Clock,      label: t('timesheets'),               desc: t('activities_desc') },
      { href: '/demandes', Icon: CreditCard, label: t('missionnaire_myPayments'),  desc: t('myPayments_desc') },
      { href: '/missions',          Icon: Plane,      label: t('missionnaire_myMissions'),  desc: t('myMissions_desc') },
    ],
  }
}

export default function AccueilClient({ prenom, role, roleLabel, fonction, omEnCours, congesEnAttente, demandesEnCours, notifsNonLues }: Props) {
  const router = useRouter()
  const t = useTranslations('home')
  const roleShortcuts = buildShortcuts(t)
  const shortcuts = roleShortcuts[role] ?? roleShortcuts['missionnaire']

  const h = new Date().getHours()
  const greeting = h < 5   ? { text: t('goodNight'),        sub: t('goodNightSub') }
                 : h < 9   ? { text: t('goodMorningEarly'), sub: t('goodMorningEarlySub') }
                 : h < 12  ? { text: t('goodMorning'),      sub: t('goodMorningSub') }
                 : h < 14  ? { text: t('lunch'),            sub: t('lunchSub') }
                 : h < 18  ? { text: t('afternoon'),        sub: t('afternoonSub') }
                 : h < 21  ? { text: t('evening'),          sub: t('eveningSub') }
                 :           { text: t('night'),             sub: t('nightSub') }

  const stats = [
    { Icon: Plane,      label: t('missionsInProgress'), value: omEnCours,       href: '/missions/en-cours', color: '#1e40af', bg: '#dbeafe' },
    { Icon: CreditCard, label: t('pendingPayments'),    value: demandesEnCours, href: '/demandes',          color: '#6d28d9', bg: '#ede9fe' },
    { Icon: Palmtree,   label: t('pendingLeaves'),      value: congesEnAttente, href: '/conges',            color: '#b45309', bg: '#fef3c7' },
    { Icon: Bell,       label: t('unreadNotifs'),       value: notifsNonLues,   href: '/notifications',     color: '#991b1b', bg: '#fee2e2' },
  ]

  return (
    <main className="page-container">
      {/* Hero welcome */}
      <div className="hero-accueil" style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
        borderRadius: 20, padding: '40px 48px', marginBottom: 32, position: 'relative', overflow: 'hidden', width: '100%',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', transform: 'translate(30%, -30%)' }} />
        <div style={{ position: 'absolute', bottom: 0, right: 80, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', transform: 'translateY(40%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 6px', fontWeight: 500 }}>
            {greeting.text},
          </p>
          <h1 style={{ color: 'white', fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: -0.5 }}>
            {prenom || 'Bienvenue'}
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
      <div className="hero-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
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
              <div style={{ marginBottom: 10, color: s.color }}>
                <s.Icon size={24} strokeWidth={1.5} color={s.color} />
              </div>
              <div style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {s.value}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Quick access */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 16 }}>{t('shortcuts')}</h2>
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
              <div style={{ flexShrink: 0, color: '#6b7280' }}>
                <s.Icon size={22} strokeWidth={1.5} color="#6b7280" />
              </div>
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
