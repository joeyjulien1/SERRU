import { NextResponse, type NextRequest } from 'next/server';
import { isAdminHost } from './lib/hosts';

/**
 * Splits one app into two sites by host name:
 *   admin.<domain>  → the admin panel (internally served from /admin/*)
 *   everything else → the storefront; /admin and admin APIs do not exist there.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const admin = isAdminHost(request.headers.get('host'));

  if (admin) {
    // Shared endpoints the admin panel uses as-is.
    if (pathname.startsWith('/api/admin/') || pathname.startsWith('/media/') || pathname === '/robots.txt') {
      return withNoIndex(NextResponse.next());
    }
    // Storefront APIs are not served on the admin host.
    if (pathname.startsWith('/api/')) return notFound(request);
    // Old habit: admin.site.com/admin/orders → admin.site.com/orders
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice('/admin'.length) || '/';
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/admin' + (pathname === '/' ? '' : pathname);
    return withNoIndex(NextResponse.rewrite(url));
  }

  // Storefront: the admin panel is invisible here.
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
    return notFound(request);
  }
  return NextResponse.next();
}

function withNoIndex(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

function notFound(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/404-not-found';
  return NextResponse.rewrite(url, { status: 404 });
}

export const config = {
  // Skip Next.js internals (assets, dev tooling) and static brand files.
  matcher: ['/((?!_next/|__nextjs|favicon.ico|icon.svg|apple-icon.png|brand/).*)'],
};
