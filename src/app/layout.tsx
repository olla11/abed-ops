import type { Metadata } from 'next'
import './globals.css'
import AppFooter from '@/components/AppFooter'

export const metadata: Metadata = {
  title: 'ABED-ONG · Gestion des opérations',
  description: 'Ordres de mission, réconciliation et timesheets',
  icons: {
    icon: '/logoabed2.png',
    shortcut: '/logoabed2.png',
    apple: '/logoabed2.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  )
}
