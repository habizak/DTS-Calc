import type { Viewport } from 'next'
import { headers } from 'next/headers'
import { THEME_BOOT_SCRIPT } from '../lib/pure/themeBootScript'
import ServiceWorkerRegister from '../components/ServiceWorkerRegister'
import './globals.css'

export const metadata = {
  title: 'DTS-Calc',
  description: 'Work out how long a run will take, or the pace you need. No clutter.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dynamic render so Next can nonce its own scripts from the request CSP.
  // The theme boot script is allowed by hash instead (see lib/pure/csp.ts).
  await headers()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/dts-calc-favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
