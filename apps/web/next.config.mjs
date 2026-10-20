import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Production auth depends on this proxy: vercel.app is on the Public Suffix
   * List, so web and api subdomains are different SITES — SameSite=Lax session
   * cookies would never be sent cross-site. Proxying /api/* through the web
   * domain keeps every API call first-party (cookies, CSRF, no CORS). Set
   * API_PROXY_TARGET to the API deployment URL in Vercel; unset locally, where
   * the browser talks to localhost:4000 directly.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [
      // The API health badge (ApiStatus) pings /health, not /api/health — proxy
      // it alongside the API itself so the badge reports the real backend state.
      { source: '/health', destination: `${target}/health` },
      { source: '/api/:path*', destination: `${target}/api/:path*` }
    ];
  }
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
