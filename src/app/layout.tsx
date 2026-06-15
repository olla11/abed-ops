import type { Metadata } from 'next'
import type { Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ABED-ONG · Gestion des opérations',
  description: 'Ordres de mission, réconciliation et timesheets',
  icons: {
    icon: '/logoabed2.png',
    shortcut: '/logoabed2.png',
    apple: '/logoabed2.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
