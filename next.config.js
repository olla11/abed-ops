const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import("next").NextConfig} */

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // camera et geolocation : nécessaires au badgeage bureau (/badge —
    // photo de vérification faciale + position GPS). Restreints à 'self'
    // (jamais à une iframe tierce) — avant, ce header bloquait ces deux
    // API au niveau HTTP, avant même la demande de permission navigateur,
    // ce qui empêchait tout badgeage quel que soit l'appareil.
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts + RSC
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles inline (Tailwind/CSS-in-JS)
      "style-src 'self' 'unsafe-inline'",
      // Images : self + Supabase storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      // Fonts — data: nécessaire pour la police de signature embarquée en base64
      "font-src 'self' data:",
      // API calls autorisés — blob: nécessaire pour que pdf.js puisse lire
      // l'aperçu d'un PDF local (pas encore uploadé) via un blob URL.
      // wss:// (en plus de https://) est indispensable pour Supabase
      // Realtime : le schéma d'une connexion WebSocket n'est jamais couvert
      // par une entrée https:// dans connect-src, même avec le même domaine
      // — sans lui, la connexion est bloquée par la CSP (pas une erreur
      // réseau), ce qui faisait planter le reste de la page au premier
      // accès à des données censées déjà être là (ex. Hub après création
      // d'une tâche) avec "Cette page n'a pas pu s'afficher".
      "connect-src 'self' blob: https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.groq.com https://generativelanguage.googleapis.com https://abedong.org https://*.abedong.org",
      // Frames : self + Supabase storage (PDF viewer)
      "frame-src 'self' https://*.supabase.co https://*.supabase.in",
      // Workers
      "worker-src 'self' blob:",
    ].join('; '),
  },
]

module.exports = withNextIntl({
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  // @sparticuz/chromium doit rester en dehors du bundle serveur : sinon
  // Next.js déplace ses fichiers et casse sa référence interne à son propre
  // dossier bin/ (erreur "input directory ... does not exist" au runtime).
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/aga/chat': ['./knowledge/**'],
    '/api/aga/reindex': ['./knowledge/**'],
    '/api/signatures/*/sign': ['./public/fonts/**'],
    '/api/tdrs/*/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/signatures/create': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
})
