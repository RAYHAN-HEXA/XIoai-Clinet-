import { NextResponse, type NextRequest } from 'next/server';

/**
 * Presence-only route guard: redirects unauthenticated browser visits away from
 * the app and authenticated visits away from the auth pages. Real verification
 * happens in the API (requireAuth) — an expired cookie still passes this check,
 * and API calls will 401 as expected.
 */
const SESSION_COOKIE = 'xc_session';
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profit',
  '/drivers',
  '/simulator',
  '/financing',
  '/brief',
  '/approvals',
  '/sources',
  '/audit',
  '/security'
];
const AUTH_PAGES = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/profit/:path*',
    '/drivers/:path*',
    '/simulator/:path*',
    '/financing/:path*',
    '/brief/:path*',
    '/approvals/:path*',
    '/sources/:path*',
    '/audit/:path*',
    '/security/:path*',
    '/login',
    '/register'
  ]
};
