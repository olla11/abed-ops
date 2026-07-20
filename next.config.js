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
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
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
      // API calls autorisés
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.groq.com https://generativelanguage.googleapis.com https://abedong.org https://*.abedong.org",
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
  outputFileTracingIncludes: {
    '/api/aga/chat': ['./knowledge/**'],
    '/api/aga/reindex': ['./knowledge/**'],
    '/api/signatures/*/sign': ['./public/fonts/**'],
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
