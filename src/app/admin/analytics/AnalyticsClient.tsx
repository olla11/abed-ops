'use client'
import { useEffect, useState } from 'react'
import { BarChart3, Zap, Users2 } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts'

type Analytics = {
  days: number
  totalActions: number
  activeUsers: number
  dailyActivity: { date: string; count: number; activeUsers: number }[]
  moduleUsage: { label: string; count: number }[]
  roleUsage: { role: string; count: number }[]
}

const GREEN = '#63a521'
const BLUE = '#2f5496'
const BAR_COLORS = ['#63a521', '#4d8019', '#2f5496', '#7c9c6b', '#9ca3af', '#b45309', '#0369a1', '#991b1b', '#6b7280', '#166534']

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function AnalyticsClient() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics?days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { setData(j); setLoading(false) })
  }, [days])

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={22} /> Analytics d&apos;usage
          </h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
            Adoption et usage de l&apos;application, pour aider à prioriser les améliorations. Accès réservé au superadmin.
          </p>
        </div>
        <div className="field" style={{ margin: 0, width: 160 }}>
          <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--abed-green)', lineHeight: 1.1 }}>{data ? data.totalActions.toLocaleString('fr-FR') : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Actions sur la période</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users2 size={18} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', lineHeight: 1.1 }}>{data ? data.activeUsers.toLocaleString('fr-FR') : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Utilisateurs actifs sur la période</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Activité dans le temps</h3>
        {!loading && data && data.dailyActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailyActivity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillActions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BLUE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} stroke="#9ca3af" />
              <YAxis fontSize={11} stroke="#9ca3af" allowDecimals={false} />
              <Tooltip labelFormatter={(label) => fmtDate(String(label))} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
              <Area type="monotone" dataKey="count" name="Actions" stroke={GREEN} fill="url(#fillActions)" strokeWidth={2} />
              <Area type="monotone" dataKey="activeUsers" name="Utilisateurs actifs" stroke={BLUE} fill="url(#fillUsers)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>
            {loading ? 'Chargement…' : 'Aucune donnée sur cette période.'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Modules les plus utilisés</h3>
          {!loading && data && data.moduleUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.moduleUsage} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="#9ca3af" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={140} fontSize={11.5} stroke="#6b7280" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
                <Bar dataKey="count" name="Actions" radius={[0, 4, 4, 0]}>
                  {data.moduleUsage.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>
              {loading ? 'Chargement…' : 'Aucune donnée sur cette période.'}
            </p>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, margin: '0 0 14px' }}>Activité par rôle</h3>
          {!loading && data && data.roleUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.roleUsage} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="#9ca3af" allowDecimals={false} />
                <YAxis type="category" dataKey="role" width={110} fontSize={11.5} stroke="#6b7280" tickFormatter={(r: string) => r.toUpperCase()} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e3e8dd' }} />
                <Bar dataKey="count" name="Actions" fill={GREEN} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--abed-muted)', textAlign: 'center', padding: '40px 0' }}>
              {loading ? 'Chargement…' : 'Aucune donnée sur cette période.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
