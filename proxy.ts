import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { NONCE_HEADER, buildCspHeader, generateNonce } from './lib/pure/csp'

export function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const cspHeader = buildCspHeader(nonce, process.env.NODE_ENV === 'development')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(NONCE_HEADER, nonce)
  // The CSP is set on BOTH the request and the response, and both are required:
  // - request header: Next's own app-render reads the nonce back out of the
  //   request-side Content-Security-Policy (getScriptNonceFromHeader) to nonce
  //   the framework scripts it injects (RSC chunks, preinit). Drop this and those
  //   scripts render without a nonce and get blocked by this very policy.
  // - response header: what the browser actually enforces.
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
}

export const config = {
  matcher: [
    // Run on document/RSC requests; skip Next's immutable build assets (they don't
    // need a per-request nonce). Everything else — page routes plus public/ files
    // like sw.js and manifest.json — still gets the CSP header, matching the
    // coverage the old next.config.ts policy had. Skip prefetches so each one
    // doesn't mint a throwaway nonce and force extra dynamic work (per Next's CSP
    // guide).
    {
      source: '/((?!_next/static|_next/image).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
