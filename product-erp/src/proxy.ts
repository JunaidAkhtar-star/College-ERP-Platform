/**
 * @file proxy.ts
 * @description Resolves configured ERP tenant subdomains and forwards tenant identity.
 * @module proxy
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Resolves a direct tenant child of the configured ERP root domain. */
function resolveTenantId(hostname: string): string {
  const rootDomain = (process.env.NEXT_PUBLIC_ERP_ROOT_DOMAIN || 'localhost')
    .split(':')[0]
    .toLowerCase();
  const normalizedHost = hostname.toLowerCase();
  const tenantSuffix = `.${rootDomain}`;

  if (normalizedHost === rootDomain || !normalizedHost.endsWith(tenantSuffix)) return '';

  const tenantLabel = normalizedHost.slice(0, -tenantSuffix.length);
  return tenantLabel && !tenantLabel.includes('.') ? tenantLabel : '';
}

/** Resolves and rewrites requests to dynamic tenant routes. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();
  const url = request.nextUrl.clone();
  let tenantId = resolveTenantId(hostname);
  const requestHeaders = new Headers(request.headers);

  const rootDomain = (process.env.NEXT_PUBLIC_ERP_ROOT_DOMAIN || 'localhost')
    .split(':')[0]
    .toLowerCase();
  if (!tenantId && hostname !== rootDomain && hostname !== 'localhost') {
    try {
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080/api/v1';
      const response = await fetch(
        `${apiBase}/tenant-domain/resolve?hostname=${encodeURIComponent(hostname)}`,
        { next: { revalidate: 60 } },
      );
      if (response.ok) {
        const payload = (await response.json()) as { data?: { tenantId?: string } };
        tenantId = payload.data?.tenantId || '';
      }
    } catch {
      tenantId = '';
    }
  }

  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    if (!url.pathname.startsWith(`/${tenantId}`)) {
      url.pathname = `/${tenantId}${url.pathname}`;
      const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
      response.cookies.set('devvelocity-tenant', tenantId, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return response;
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
