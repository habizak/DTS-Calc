import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import ServiceWorkerRegister from '../components/ServiceWorkerRegister'
import { LINK_PREVIEW } from '../lib/pure/linkPreview'
import './globals.css'

export const metadata: Metadata = {
  title: 'DTS-Calc',
  description: LINK_PREVIEW.description,
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/assets/dts-calc-favicon.svg', type: 'image/svg+xml' },
      { url: '/assets/dts-calc-favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/assets/dts-calc-favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/assets/apple-touch-icon.png',
  },
  openGraph: {
    title: LINK_PREVIEW.title,
    description: LINK_PREVIEW.description,
    url: LINK_PREVIEW.url,
    siteName: LINK_PREVIEW.siteName,
    type: 'website',
    images: [{ url: LINK_PREVIEW.image, width: 1200, height: 630, alt: LINK_PREVIEW.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: LINK_PREVIEW.title,
    description: LINK_PREVIEW.description,
    images: [{ url: LINK_PREVIEW.image, alt: LINK_PREVIEW.imageAlt }],
  },
  other: { 'apple-mobile-web-app-title': 'DTS-Calc' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#c20707',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dynamic render so Next can nonce its own scripts from the request CSP (see proxy.ts).
  await headers()
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
