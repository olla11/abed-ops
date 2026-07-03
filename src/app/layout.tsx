import type { Metadata } from 'next'
import type { Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Script from 'next/script'
import { GoogleTranslateReapply } from '@/components/GoogleTranslate'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <style>{`
          /* Hide GT toolbar/banner but keep widget alive */
          .goog-te-banner-frame { display: none !important; }
          .goog-te-balloon-frame { display: none !important; }
          #goog-gt-tt { display: none !important; }
          body { top: 0 !important; }
        `}</style>
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <GoogleTranslateReapply />
        </NextIntlClientProvider>

        {/* GT widget placed off-screen — must NOT use display:none or visibility:hidden */}
        <div
          id="google_translate_element"
          style={{ position: 'fixed', bottom: 0, left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
        />

        <Script id="gt-init" strategy="afterInteractive">{`
          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement(
              { pageLanguage: 'fr', includedLanguages: 'en', autoDisplay: false },
              'google_translate_element'
            );
            // Auto-apply if cookie already set (page reload case)
            if (document.cookie.indexOf('googtrans=/fr/en') >= 0) {
              setTimeout(window.__doGT, 600);
            }
          };

          window.__doGT = function(lang) {
            lang = lang || 'en';
            var sels = document.querySelectorAll('select.goog-te-combo');
            if (!sels.length) { setTimeout(function(){ window.__doGT(lang); }, 300); return; }
            var combo = sels[0];
            combo.value = lang;
            combo.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(function(){ combo.dispatchEvent(new Event('change', { bubbles: true })); }, 200);
          };
        `}</Script>
        <Script
          src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
